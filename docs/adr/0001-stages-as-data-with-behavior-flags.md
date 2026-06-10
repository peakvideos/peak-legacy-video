# ADR 0001: Stages as data, with behavior flags

## Status

Accepted (2026-06-10)

## Context

The Pipeline's Stages were a hardcoded Postgres enum (`lead_stage`), and
system behavior branched on stage values by name: inquiry capture inserted
`'new'`, booking promoted `'new' | 'stale'` to `'booked_a_call'`, the
admin views filtered on `'closed'`/`'lost'`, the inbox hardcoded its
waiting stages, and the UI carried per-stage maps for labels, colors, and
hints. The CRM overhaul PRD requires the Owner to add, rename, recolor,
reorder, and delete Stages freely — impossible while any code path knows a
Stage by name.

## Decision

Stages become rows in a `stages` table: name, color (a palette key),
description (the board column's empty-state hint), position, and three
**Behavior flags** — Won, Lost, Needs my action. Leads and Automations
reference Stages by id. A single-row `settings` store holds the pointers
and knobs system behavior binds to instead of names:

- **Entry Stage** — where inquiry submissions land (and whose automations
  they enqueue).
- **Booking Stage** — the promotion target when a Lead books a call.
  Promotion is **forward-only by position**: only Leads in a Stage
  positioned before the Booking Stage move; Leads at or past it are left
  where the Owner put them.
- **Cold threshold (days, default 14)** — drives the stuck view, sidebar
  count, inbox cold events, and cold indicators. Cold is derived at read
  time and never moves a Lead.
- **Paused** — the global send switch (stored now; honored by the send
  worker when the Outbox slice lands).

No code path may reference a Stage by name or slug. Everything that used
to branch on a stage value now binds through a flag, a settings pointer,
or position: terminal behavior (active/closed views, sidebar counts,
next-email display) through Won/Lost; "waiting on you" surfaces through
Needs my action; capture and promotion through the settings pointers.

The migration seeds the current eight Stages with positions, colors,
descriptions, and flags reproducing the previous behavior exactly (Won on
Closed, Lost on Lost, Needs my action on Call completed and Post video
shoot, Entry = New, Booking = Booked a call), and backfills `stage_id`
from the old enum before dropping it — the slice ships dark. "Stale" is
demoted to an ordinary seeded Stage, deletable like any other; the Cold
indicator replaces its semantics over time.

### Derivations the UI uses instead of names

- The board's "Active funnel"/"Settled" tabs: **Settled is the trailing
  run of flagged Stages** (Won, Lost, or Needs my action) at the end of
  the Pipeline; the Active funnel is everything before it. With the seeded
  pipeline this reproduces the previous split exactly.
- Kanban cards talk email-drip ("No emails queued") for Stages positioned
  at or before the Booking Stage, and last-touch ("Updated Xd ago") past
  it.
- The "Cold — decide to revive or archive" hint binds to the derived Cold
  state (untouched past the threshold) rather than to the Stale stage.

## Alternatives rejected

- **Keep the enum, add a per-stage config table.** Renames and custom
  stages would still require migrations; two sources of truth.
- **Slug-keyed stage rows.** A stable slug invites code to branch on it,
  recreating the name-binding problem with extra steps.
- **Bind behavior to well-known stage names.** Renaming a Stage would
  silently change system behavior — the exact failure mode this redesign
  exists to prevent.
- **Persist Cold (auto-move to a stale stage).** The PRD forbids automatic
  Stage moves; Cold is a read-time derivation.

## Consequences

- Stage management UI (add/rename/recolor/reorder/delete with the five
  delete rules) can build on this without further schema work.
- Per-stage admin URLs are `/admin/stages/<id>` instead of the old slug
  paths.
- Hand-tuned per-stage styling collapsed into a per-color palette; the
  Stale badge tint shifted from blush to tofino to keep the palette
  coherent. Everything else is pixel-identical.
- Tests re-seed the default Stages and settings after each truncate; the
  seed lives in `lib/stages/defaults.ts` and must stay in sync with the
  migration that introduced it.

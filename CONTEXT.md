# Peak Studios CO Legacy Video

Inbound sales system for a legacy-film studio: a landing page that converts visitors into booked discovery calls, backed by an owner-only CRM and email sequences.

## Language

**Owner**:
Marc Black — the filmmaker behind Peak Studios CO and the system's only authenticated user. Takes the discovery calls the site books.
_Avoid_: Admin, client (the Owner is our client, but in-product he is the Owner)

**Hero VSL**:
Marc's short (23-second) talking-head introduction video at the top of the landing page. Despite the name, it is a personal greeting, not a long-form video sales letter; its spoken audio is the content. Plays only when a visitor chooses to watch, always with sound.
_Avoid_: Hero video, background video, promo

**Poster**:
The still image with a play affordance that represents the Hero VSL before playback (and after it ends). It is the hero's visual for every visitor who never presses play.
_Avoid_: Thumbnail, placeholder

**Stage**:
A column in the Pipeline, stored as a row (name, color, position, Behavior flags) — never as code. System behavior binds to a Stage's flags or to settings pointers, never to its name. See ADR 0001.
_Avoid_: status, phase, stage enum

**Pipeline**:
The ordered set of Stages a Lead moves through, shown as the kanban board. There is exactly one.
_Avoid_: workflow, funnel (the board's "Active funnel" tab is a view of the Pipeline, not the Pipeline itself)

**Behavior flag**:
One of Won, Lost, or Needs my action on a Stage. The only way system behavior attaches to a Stage besides the settings pointers — flags survive renames, recolors, and reorders.
_Avoid_: stage type, stage kind

**Terminal Stage**:
A Stage flagged Won or Lost. Leads there are finished: no Automations run, they are excluded from active views and shown in the Closed view.
_Avoid_: archived stage, end stage

**Entry Stage**:
The settings pointer naming the Stage where inquiry submissions land and whose Automations they enqueue.
_Avoid_: new stage, default stage

**Booking Stage**:
The settings pointer naming the Stage a Lead is promoted to on booking a call. Promotion is forward-only by Stage position; a Lead at or past the Booking Stage is never moved by booking.
_Avoid_: booked stage

**Automation**:
A Template attached to a Stage with a delay. Entering the Stage enqueues it (delay counted from entry); leaving cancels unsent jobs; a Template the Lead already received is skipped forever.
_Avoid_: drip, sequence step

**Template**:
A reusable email — subject plus rich-text body with `{{variable}}` placeholders — independent of any Stage. The one-off composer and Automations both draw from Templates.
_Avoid_: email (ambiguous with Email Job)

**Email Job**:
A scheduled send of a Template to a Lead (an `email_jobs` row): pending, sent, cancelled, or failed. The send worker drains due pending jobs.
_Avoid_: queued email, message

**Outbox**:
The chronological view of every upcoming and past send across all Leads: a Pending tab with rendered previews, Cancel, and Send now, and a Sent tab recording sent and failed sends with their errors. Replaced the jobs list.
_Avoid_: queue page, sequences page (the page it replaced)

**Paused**:
The global switch on the Outbox that holds all sending without cancelling anything: the send worker attempts no jobs while Paused, and held emails (including overdue ones) send on the first run after resume. Send now still works — a deliberate per-email override.
_Avoid_: disabled, stopped

**Cold**:
A read-time derivation: a Lead untouched for at least the Cold threshold (settings, default 14 days). Cold surfaces indicators and inbox events but never moves a Lead.
_Avoid_: stale (the demoted seeded Stage of that name), auto-archive

**Journey**:
The single view showing every Stage left-to-right with its Automations as time-ordered cards (delay first, drag-set position breaking ties) — the Owner's one editing surface for the email experience: delays edit in place, Automations drag-reorder, emails are added by picking a Template or writing one in place, and detaching shelves the Template as Unattached. The Templates settings page and per-Stage pages remain until the Journey reaches full parity (inline Template editing is still pending).
_Avoid_: sequence editor, flow builder

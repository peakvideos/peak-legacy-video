/**
 * The Cold derivation — computed at read time wherever leads are shown,
 * never persisted, and never a reason to move a lead (see issue #14 and
 * the Cold entry in CONTEXT.md).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant a lead's `updatedAt` must be at or before to read as Cold —
 * the SQL-side mirror of `isCold` for queries that filter or count cold
 * leads (`updatedAt <= cutoff`).
 */
export function coldCutoff(
  coldThresholdDays: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - coldThresholdDays * DAY_MS);
}

/**
 * A lead is Cold when it has gone untouched for at least the cold
 * threshold. Touch = any change to the lead row (`updatedAt`). Leads in a
 * terminal stage are finished, never Cold; an unknown stage counts as in
 * play.
 */
export function isCold(
  lead: { updatedAt: Date },
  stage: { isWon: boolean; isLost: boolean } | undefined,
  coldThresholdDays: number,
  now: Date = new Date(),
): boolean {
  if (stage && (stage.isWon || stage.isLost)) return false;
  return now.getTime() - lead.updatedAt.getTime() >= coldThresholdDays * DAY_MS;
}

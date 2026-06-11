import { expect, test } from "vitest";
import { isCold } from "@/lib/admin/cold";

const DAY_MS = 24 * 60 * 60 * 1000;

const now = new Date("2026-06-10T12:00:00Z");

/** A stage with no terminal flag — a lead here is still in play. */
const activeStage = { isWon: false, isLost: false };

function touchedDaysAgo(days: number) {
  return { updatedAt: new Date(now.getTime() - days * DAY_MS) };
}

test("a lead untouched for at least the threshold is cold; one touched just inside it is not", async () => {
  expect(isCold(touchedDaysAgo(14), activeStage, 14, now)).toBe(true);
  expect(isCold(touchedDaysAgo(13.999), activeStage, 14, now)).toBe(false);
});

test("changing the threshold changes whether the same lead is cold", async () => {
  const lead = touchedDaysAgo(20);
  expect(isCold(lead, activeStage, 14, now)).toBe(true);
  expect(isCold(lead, activeStage, 30, now)).toBe(false);
});

test("a lead in a terminal stage is never cold — finished leads can't be neglected", async () => {
  const lead = touchedDaysAgo(90);
  expect(isCold(lead, { isWon: true, isLost: false }, 14, now)).toBe(false);
  expect(isCold(lead, { isWon: false, isLost: true }, 14, now)).toBe(false);
  // An unknown stage (e.g. data outracing a stale view) still counts as in play.
  expect(isCold(lead, undefined, 14, now)).toBe(true);
});

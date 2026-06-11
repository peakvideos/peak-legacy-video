import { expect, test } from "vitest";
import {
  formatDelayLabel,
  formatDelayPhrase,
  parseDelay,
} from "@/lib/admin/delay";

test("plain delay formats parse to minutes: 5m, 2h, 3d", () => {
  expect(parseDelay("5m")).toBe(5);
  expect(parseDelay("2h")).toBe(120);
  expect(parseDelay("3d")).toBe(60 * 24 * 3);
  expect(parseDelay("0m")).toBe(0);
});

test("the parser is forgiving about case, spacing, and fractions", () => {
  expect(parseDelay(" 2H ")).toBe(120);
  expect(parseDelay("1.5h")).toBe(90);
  expect(parseDelay("0.5d")).toBe(60 * 12);
});

test("a bare number is taken as minutes", () => {
  expect(parseDelay("45")).toBe(45);
  expect(parseDelay("0")).toBe(0);
});

test("invalid input is rejected, not coerced", () => {
  expect(parseDelay("")).toBeNull();
  expect(parseDelay("   ")).toBeNull();
  expect(parseDelay("-5m")).toBeNull();
  expect(parseDelay("-5")).toBeNull();
  expect(parseDelay("5w")).toBeNull();
  expect(parseDelay("soon")).toBeNull();
  expect(parseDelay("h")).toBeNull();
  expect(parseDelay("Infinity")).toBeNull();
});

test("delays read as humans say them", () => {
  expect(formatDelayLabel(0)).toBe("immediately");
  expect(formatDelayLabel(45)).toBe("45 min");
  expect(formatDelayLabel(60)).toBe("1 hour");
  expect(formatDelayLabel(120)).toBe("2 hours");
  expect(formatDelayLabel(90)).toBe("90 min");
  expect(formatDelayLabel(60 * 24)).toBe("1 day");
  expect(formatDelayLabel(60 * 24 * 3)).toBe("3 days");
});

test("the full phrase never says 'after immediately'", () => {
  expect(formatDelayPhrase(0)).toBe("immediately");
  expect(formatDelayPhrase(60)).toBe("after 1 hour");
  expect(formatDelayPhrase(60 * 24 * 2)).toBe("after 2 days");
});

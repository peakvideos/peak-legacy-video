import { expect, test } from "vitest";
import { formatDelayLabel, formatDelayPhrase } from "@/lib/admin/delay";

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

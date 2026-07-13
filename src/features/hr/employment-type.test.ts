import { describe, expect, it } from "vitest";

import {
  EOD_GRACE_MINUTES,
  countsAsMissingEod,
  expectsCheckInAlert,
  isPartTime,
} from "./employment-type";

const NOW = new Date("2026-07-13T18:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("expectsCheckInAlert", () => {
  it("never fires for part-time employees", () => {
    expect(expectsCheckInAlert("Part-time")).toBe(false);
    expect(expectsCheckInAlert("part-time")).toBe(false);
  });

  it("fires for full-time and any unknown / missing type", () => {
    expect(expectsCheckInAlert("Full-time")).toBe(true);
    expect(expectsCheckInAlert("Contractor")).toBe(true);
    expect(expectsCheckInAlert(null)).toBe(true);
    expect(expectsCheckInAlert(undefined)).toBe(true);
  });
});

describe("countsAsMissingEod", () => {
  it("always counts full-time / unknown types (day-boundary handled elsewhere)", () => {
    expect(countsAsMissingEod("Full-time", null, NOW)).toBe(true);
    expect(countsAsMissingEod("Contractor", null, NOW)).toBe(true);
    expect(countsAsMissingEod(null, null, NOW)).toBe(true);
  });

  it("counts a part-timer once their session finished beyond the grace window", () => {
    expect(countsAsMissingEod("Part-time", minutesAgo(EOD_GRACE_MINUTES + 1), NOW)).toBe(true);
  });

  it("does not count a part-timer still within the grace window after finishing", () => {
    expect(countsAsMissingEod("Part-time", minutesAgo(EOD_GRACE_MINUTES - 1), NOW)).toBe(false);
  });

  it("does not count a part-timer who never started/finished a session (didn't work)", () => {
    expect(countsAsMissingEod("Part-time", null, NOW)).toBe(false);
    expect(countsAsMissingEod("Part-time", undefined, NOW)).toBe(false);
  });

  // Guards the assumption the predicate keys on.
  it("sanity: part-time slug normalises", () => {
    expect(isPartTime("Part-time")).toBe(true);
    expect(isPartTime("Full-time")).toBe(false);
  });
});

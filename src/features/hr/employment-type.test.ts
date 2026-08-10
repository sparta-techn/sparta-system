import { describe, expect, it } from "vitest";

import {
  EOD_GRACE_MINUTES,
  countsAsMissingEod,
  creditedBreakSeconds,
  dayProgressSeconds,
  expectedWorkMinutesFor,
  expectsCheckInAlert,
  hasBreakAllowance,
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

describe("break allowance sits inside the full-time day", () => {
  const HOUR = 3600;
  const MAX_BREAK = HOUR; // company_settings.max_break_minutes = 60

  it("gives full-time (and unknown types) a capped break credit", () => {
    expect(hasBreakAllowance("Full-time")).toBe(true);
    expect(hasBreakAllowance(null)).toBe(true);
    expect(creditedBreakSeconds("Full-time", HOUR, MAX_BREAK)).toBe(HOUR);
    expect(creditedBreakSeconds("Full-time", 2 * HOUR, MAX_BREAK)).toBe(HOUR); // capped
    expect(creditedBreakSeconds("Full-time", 900, MAX_BREAK)).toBe(900); // took less
  });

  it("gives part-time no allowance at all", () => {
    expect(hasBreakAllowance("Part-time")).toBe(false);
    expect(creditedBreakSeconds("Part-time", 3 * HOUR, MAX_BREAK)).toBe(0);
  });

  it("completes a full-time day at 7h worked + 1h break", () => {
    const target = expectedWorkMinutesFor("Full-time", 480) * 60;
    expect(dayProgressSeconds("Full-time", 7 * HOUR, HOUR, MAX_BREAK)).toBe(target);
  });

  it("requires a part-timer to work the full 4h however long they break", () => {
    const target = expectedWorkMinutesFor("Part-time", 480) * 60;
    expect(target).toBe(4 * HOUR);
    expect(dayProgressSeconds("Part-time", 3 * HOUR, 2 * HOUR, MAX_BREAK)).toBe(3 * HOUR);
    expect(dayProgressSeconds("Part-time", 4 * HOUR, 2 * HOUR, MAX_BREAK)).toBe(target);
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

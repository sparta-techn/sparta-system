import { describe, expect, it } from "vitest";

import {
  EOD_GRACE_MINUTES,
  countsAsMissingEod,
  expectedWorkMinutesFor,
  expectsCheckInAlert,
  hasBreakAllowance,
  isPartTime,
  netWorkTargetMinutes,
  paidBreakCreditMinutes,
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

describe("the day is worked in net time, but paid as the scheduled day", () => {
  const DAY = 480; // company_settings.expected_work_minutes
  const MAX_BREAK = 60; // company_settings.max_break_minutes

  it("keeps the break allowance for full-time (and unknown types)", () => {
    expect(hasBreakAllowance("Full-time")).toBe(true);
    expect(hasBreakAllowance(null)).toBe(true);
    expect(hasBreakAllowance("Part-time")).toBe(false);
  });

  it("targets 7h of WORK for full-time, and pays the 8h scheduled day", () => {
    expect(netWorkTargetMinutes("Full-time", DAY, MAX_BREAK)).toBe(420);
    expect(expectedWorkMinutesFor("Full-time", DAY)).toBe(480);
    // The gap is the paid break hour, credited by payroll once the day completes.
    expect(paidBreakCreditMinutes("Full-time", DAY, MAX_BREAK)).toBe(60);
  });

  it("applies the same rule to an unknown employment type", () => {
    expect(netWorkTargetMinutes(null, DAY, MAX_BREAK)).toBe(420);
    expect(paidBreakCreditMinutes(undefined, DAY, MAX_BREAK)).toBe(60);
  });

  it("leaves part-time at 4h worked with no uplift", () => {
    expect(netWorkTargetMinutes("Part-time", DAY, MAX_BREAK)).toBe(240);
    expect(expectedWorkMinutesFor("Part-time", DAY)).toBe(240);
    expect(paidBreakCreditMinutes("Part-time", DAY, MAX_BREAK)).toBe(0);
  });

  it("tracks the company settings rather than hardcoding 7h", () => {
    // A 9h day with a 30-min allowance → 8h30 of work, 30 min credited.
    expect(netWorkTargetMinutes("Full-time", 540, 30)).toBe(510);
    expect(paidBreakCreditMinutes("Full-time", 540, 30)).toBe(30);
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

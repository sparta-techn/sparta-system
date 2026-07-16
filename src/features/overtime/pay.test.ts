import { describe, expect, it } from "vitest";

import {
  fullTimeHourlyRate,
  overtimeMultiplierFor,
  overtimePayAmount,
  overtimeWorkedSeconds,
  workingDaysInMonth,
} from "./pay";

// Egypt-style weekend: Friday (5) and Saturday (6). 0=Sun..6=Sat.
const WEEKEND = [5, 6];
const EXPECTED_DAILY_HOURS = 8; // company_settings.expected_work_minutes 480 / 60

describe("workingDaysInMonth", () => {
  it("counts July 2026 as 22 working days (5 Fri + 4 Sat off 31)", () => {
    // Pinned against the deployed working_days_in_month(2026-07-01) = 22.
    expect(workingDaysInMonth(new Date(Date.UTC(2026, 6, 1)), WEEKEND)).toBe(22);
  });

  it("subtracts full-day holidays that fall on a working day", () => {
    const holidays = new Set(["2026-07-23"]); // a Thursday
    expect(workingDaysInMonth(new Date(Date.UTC(2026, 6, 1)), WEEKEND, holidays)).toBe(21);
  });

  it("ignores holidays that land on a weekend (already excluded)", () => {
    const holidays = new Set(["2026-07-24"]); // a Friday — already a weekend
    expect(workingDaysInMonth(new Date(Date.UTC(2026, 6, 1)), WEEKEND, holidays)).toBe(22);
  });
});

describe("fullTimeHourlyRate", () => {
  it("derives the hourly base from monthly salary and working days", () => {
    // 20000 / (8 × 22) = 113.636…
    expect(fullTimeHourlyRate(20000, EXPECTED_DAILY_HOURS, 22)).toBeCloseTo(113.6363636, 6);
  });

  it("returns null when salary is missing or the divisor collapses", () => {
    expect(fullTimeHourlyRate(null, EXPECTED_DAILY_HOURS, 22)).toBeNull();
    expect(fullTimeHourlyRate(20000, 0, 22)).toBeNull();
    expect(fullTimeHourlyRate(20000, EXPECTED_DAILY_HOURS, 0)).toBeNull();
  });
});

describe("overtimePayAmount — parity with the deployed server function", () => {
  it("full-time · 20 000 EGP · 2h30m · ×1.5 → 426.14 (matches server)", () => {
    const base = fullTimeHourlyRate(20000, EXPECTED_DAILY_HOURS, 22)!;
    expect(overtimePayAmount(9000, base, 1.5)).toBe(426.14);
  });

  it("full-time · 30 000 EGP · 1h · ×1.5 → 255.68 (matches server)", () => {
    const base = fullTimeHourlyRate(30000, EXPECTED_DAILY_HOURS, 22)!;
    expect(overtimePayAmount(3600, base, 1.5)).toBe(255.68);
  });

  it("part-time · 60 EGP/h · 3h · ×1.0 → 180.00 (matches server)", () => {
    expect(overtimePayAmount(10800, 60, 1.0)).toBe(180);
  });

  it("never goes negative and treats missing rate as 0", () => {
    expect(overtimePayAmount(-5000, 100, 1.5)).toBe(0);
    expect(overtimePayAmount(3600, null, 1.5)).toBe(0);
  });
});

describe("overtimeMultiplierFor", () => {
  it("is 1.0 for part-time and 1.5 otherwise", () => {
    expect(overtimeMultiplierFor("part-time")).toBe(1.0);
    expect(overtimeMultiplierFor("full-time")).toBe(1.5);
    expect(overtimeMultiplierFor(null)).toBe(1.5);
  });
});

describe("overtimeWorkedSeconds", () => {
  it("is whole seconds between start and end", () => {
    expect(overtimeWorkedSeconds("2026-07-15T18:00:00Z", "2026-07-15T20:30:00Z")).toBe(9000);
  });
  it("is 0 while the session is unfinished", () => {
    expect(overtimeWorkedSeconds("2026-07-15T18:00:00Z", null)).toBe(0);
    expect(overtimeWorkedSeconds(null, null)).toBe(0);
  });
});

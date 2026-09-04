import { describe, expect, it } from "vitest";

import { computeWorkedSeconds, dayTargetThresholdAt } from "./rules";
import { netWorkTargetMinutes, paidBreakCreditMinutes } from "@/features/hr/employment-type";

/**
 * Parity tests for AUTO-FINISH and the overnight boundary, mirroring the server
 * functions `finish_work_session` / `session_net_work_threshold_ts` /
 * `auto_finish_session_if_due` / `payroll_report` in migration 20260904130000.
 * These run without a database (the SQL is the authoritative copy; this pins the
 * arithmetic, exactly like pay.test.ts).
 *
 * The threshold computed here is what the server writes as the session's
 * `finished_at`, so these cases also pin *when a day is closed*. It is NET
 * WORKING TIME — time in the `working` state, break time excluded — so the same
 * amount of work is required whether the employee takes their break, splits it,
 * or skips it. A break only moves the wall-clock instant at which that work is
 * finished.
 */

const HOUR = 3600;
const DAY_MINUTES = 480; // company_settings.expected_work_minutes
const MAX_BREAK_MINUTES = 60; // company_settings.max_break_minutes

/** 7h of work for full-time, 4h for part-time — what has to be on the clock. */
const FULL_TIME_TARGET = netWorkTargetMinutes("Full-time", DAY_MINUTES, MAX_BREAK_MINUTES) * 60;
const PART_TIME_TARGET = netWorkTargetMinutes("Part-time", DAY_MINUTES, MAX_BREAK_MINUTES) * 60;

const iso = (s: string) => new Date(s);

describe("the targets themselves", () => {
  it("is 7h worked for full-time and 4h worked for part-time", () => {
    expect(FULL_TIME_TARGET).toBe(7 * HOUR);
    expect(PART_TIME_TARGET).toBe(4 * HOUR);
  });
});

describe("duration math is date-agnostic across midnight", () => {
  it("a 23:00 → 03:00 overnight span is 4h worked, not a conflict", () => {
    // The bug was never in the math — (finished_at − started_at) already spans
    // midnight. It was the row *lookup* keying on today's date. Proving the math
    // here shows the fixed lookup feeds correct absolute timestamps.
    expect(computeWorkedSeconds(iso("2026-07-15T23:00:00Z"), iso("2026-07-16T03:00:00Z"), 0)).toBe(
      4 * HOUR,
    );
  });

  it("subtracts breaks the same way regardless of the midnight crossing", () => {
    // 23:00 → 04:00 gross = 5h, minus a 1h break = 4h net.
    expect(
      computeWorkedSeconds(iso("2026-07-15T23:00:00Z"), iso("2026-07-16T04:00:00Z"), HOUR),
    ).toBe(4 * HOUR);
  });
});

describe("auto-finish instant (dayTargetThresholdAt)", () => {
  it("closes a full-timer at the 7th worked hour — 09:00 start, no break", () => {
    const t = dayTargetThresholdAt(
      iso("2026-07-15T09:00:00Z"),
      [],
      FULL_TIME_TARGET,
      iso("2026-07-15T18:00:00Z"),
    );
    expect(t?.toISOString()).toBe("2026-07-15T16:00:00.000Z");
  });

  it("returns null before the target is reached", () => {
    // Only 3h worked at 02:00 → part-time 4h target not yet met.
    expect(
      dayTargetThresholdAt(
        iso("2026-07-15T23:00:00Z"),
        [],
        PART_TIME_TARGET,
        iso("2026-07-16T02:00:00Z"),
      ),
    ).toBeNull();
  });

  it("pushes the close by the exact time spent on break", () => {
    // Start 23:00, 30-min break 01:00–01:30, part-time 4h target.
    // Working time reaches 4h at 03:30 (23:00 + 4h + 30m break).
    const t = dayTargetThresholdAt(
      iso("2026-07-15T23:00:00Z"),
      [{ startedAt: iso("2026-07-16T01:00:00Z"), endedAt: iso("2026-07-16T01:30:00Z") }],
      PART_TIME_TARGET,
      iso("2026-07-16T04:00:00Z"),
    );
    expect(t?.toISOString()).toBe("2026-07-16T03:30:00.000Z");
  });

  it("returns null while mid-break — working time is frozen", () => {
    // Start 23:00, on break since 01:00 (3h worked). Frozen under the 4h target,
    // however long the break runs.
    expect(
      dayTargetThresholdAt(
        iso("2026-07-15T23:00:00Z"),
        [{ startedAt: iso("2026-07-16T01:00:00Z"), endedAt: null }],
        PART_TIME_TARGET,
        iso("2026-07-16T05:00:00Z"),
      ),
    ).toBeNull();
  });

  it("a late sweep still back-dates the close to the real instant", () => {
    // Crossing happened at 03:00; the cron sweep only runs at 03:47. The instant
    // must be 03:00, not 03:47 — the server back-dates from real timestamps.
    const t = dayTargetThresholdAt(
      iso("2026-07-15T23:00:00Z"),
      [],
      PART_TIME_TARGET,
      iso("2026-07-16T03:47:00Z"),
    );
    expect(t?.toISOString()).toBe("2026-07-16T03:00:00.000Z");
  });
});

describe("the break never changes how much work the day needs", () => {
  const start = iso("2026-07-15T09:00:00Z");
  const evening = iso("2026-07-15T23:00:00Z");

  it("skipping the break entirely still finishes the day — at 16:00", () => {
    // No break is required to complete: 7h of continuous work is a full day.
    const t = dayTargetThresholdAt(start, [], FULL_TIME_TARGET, evening);
    expect(t?.toISOString()).toBe("2026-07-15T16:00:00.000Z");
    expect(computeWorkedSeconds(start, t!, 0)).toBe(FULL_TIME_TARGET);
  });

  it("taking the full hour finishes the same day's work at 17:00", () => {
    const t = dayTargetThresholdAt(
      start,
      [{ startedAt: iso("2026-07-15T12:00:00Z"), endedAt: iso("2026-07-15T13:00:00Z") }],
      FULL_TIME_TARGET,
      evening,
    );
    expect(t?.toISOString()).toBe("2026-07-15T17:00:00.000Z");
    expect(computeWorkedSeconds(start, t!, HOUR)).toBe(FULL_TIME_TARGET);
  });

  it("a 3h break past the allowance still needs exactly 7h of work", () => {
    // The break is over the allowance, so it costs pay — but it does not change
    // the target. 7h worked is reached at 19:00.
    const t = dayTargetThresholdAt(
      start,
      [{ startedAt: iso("2026-07-15T12:00:00Z"), endedAt: iso("2026-07-15T15:00:00Z") }],
      FULL_TIME_TARGET,
      evening,
    );
    expect(t?.toISOString()).toBe("2026-07-15T19:00:00.000Z");
    expect(computeWorkedSeconds(start, t!, 3 * HOUR)).toBe(FULL_TIME_TARGET);
  });

  it("splitting the break across the day changes nothing but the clock", () => {
    // Four 15-minute breaks = 1h total, so the same 17:00 close as one long one.
    const t = dayTargetThresholdAt(
      start,
      [
        { startedAt: iso("2026-07-15T10:00:00Z"), endedAt: iso("2026-07-15T10:15:00Z") },
        { startedAt: iso("2026-07-15T12:00:00Z"), endedAt: iso("2026-07-15T12:15:00Z") },
        { startedAt: iso("2026-07-15T14:00:00Z"), endedAt: iso("2026-07-15T14:15:00Z") },
        { startedAt: iso("2026-07-15T16:00:00Z"), endedAt: iso("2026-07-15T16:15:00Z") },
      ],
      FULL_TIME_TARGET,
      evening,
    );
    expect(t?.toISOString()).toBe("2026-07-15T17:00:00.000Z");
  });

  it("never closes a day while the employee is still on break", () => {
    // 6h30 worked, break opened at 15:30 and still running at 23:00. Unlike the
    // old break-credit rule — which could complete the day mid-break — working
    // time is frozen, so the last 30 min must actually be worked.
    expect(
      dayTargetThresholdAt(
        start,
        [{ startedAt: iso("2026-07-15T15:30:00Z"), endedAt: null }],
        FULL_TIME_TARGET,
        evening,
      ),
    ).toBeNull();
  });

  it("part-time follows the identical rule at 4h", () => {
    const t = dayTargetThresholdAt(
      start,
      [{ startedAt: iso("2026-07-15T10:00:00Z"), endedAt: iso("2026-07-15T11:00:00Z") }],
      PART_TIME_TARGET,
      evening,
    );
    expect(t?.toISOString()).toBe("2026-07-15T14:00:00.000Z"); // 4h worked + 1h break
  });
});

describe("payroll credits the scheduled day for an auto-finished day", () => {
  // Mirrors the per-day `work_agg` term in payroll_report:
  //   day hours = SUM(working_seconds) + (break credit if auto-finished & not PT)
  const credit = (type: string) =>
    paidBreakCreditMinutes(type, DAY_MINUTES, MAX_BREAK_MINUTES) * 60;
  const payrollDaySeconds = (type: string, workedSeconds: number, autoFinished: boolean) =>
    workedSeconds + (autoFinished ? credit(type) : 0);

  it("pays a full-time auto-finished day as the full 8h scheduled day", () => {
    expect(payrollDaySeconds("Full-time", FULL_TIME_TARGET, true)).toBe(8 * HOUR);
    expect(payrollDaySeconds("Full-time", FULL_TIME_TARGET, true)).toBe(DAY_MINUTES * 60);
  });

  it("pays the break hour even when the break was skipped", () => {
    // Identical session shape either way — the session records 7h worked, and
    // the credit is unconditional on a completed day.
    const workedHavingSkipped = computeWorkedSeconds(
      iso("2026-07-15T09:00:00Z"),
      iso("2026-07-15T16:00:00Z"),
      0,
    );
    expect(payrollDaySeconds("Full-time", workedHavingSkipped, true)).toBe(8 * HOUR);
  });

  it("leaves part-time at their tracked 4h — no uplift", () => {
    expect(credit("Part-time")).toBe(0);
    expect(payrollDaySeconds("Part-time", PART_TIME_TARGET, true)).toBe(4 * HOUR);
  });

  it("does not credit a day the employee finished manually", () => {
    // Left at 15:00 having worked 6h: they are paid the 6h, not a full day.
    expect(payrollDaySeconds("Full-time", 6 * HOUR, false)).toBe(6 * HOUR);
  });

  it("adds a post-auto-finish top-up session on top of the scheduled day", () => {
    // 7h auto-finished + a 1h second session = 8h paid day + 1h logged extra.
    expect(payrollDaySeconds("Full-time", FULL_TIME_TARGET + HOUR, true)).toBe(9 * HOUR);
  });
});

describe("COMBINED — part-time overnight shift auto-finished across midnight", () => {
  // A part-time employee starts at 11:00 PM and hits their 4h working target at
  // 3:00 AM, crossing midnight. The session is CLOSED at 3:00 AM by the sweep.
  const startedAt = iso("2026-07-15T23:00:00Z"); // 11:00 PM, work_date = 2026-07-15
  // The sweep runs on a 10-minute cadence, so it may not observe the crossing
  // until well after it happened. That must not move the recorded check-out.
  const sweptAt = iso("2026-07-16T03:09:00Z");

  const threshold = dayTargetThresholdAt(startedAt, [], PART_TIME_TARGET, sweptAt);

  it("closes at exactly 03:00 the next calendar day", () => {
    expect(threshold?.toISOString()).toBe("2026-07-16T03:00:00.000Z");
  });

  it("a late sweep back-dates the close — cadence never inflates the day", () => {
    const later = dayTargetThresholdAt(
      startedAt,
      [],
      PART_TIME_TARGET,
      iso("2026-07-16T08:00:00Z"),
    );
    expect(later?.toISOString()).toBe(threshold?.toISOString());
  });

  it("the closed session holds exactly the 4h target, not the elapsed time", () => {
    const worked = computeWorkedSeconds(startedAt, threshold!, 0);
    expect(worked).toBe(PART_TIME_TARGET);
    expect(worked).toBe(4 * HOUR);
    // Not the 4h09m that had actually elapsed when the sweep ran.
    expect(computeWorkedSeconds(startedAt, sweptAt, 0)).toBeGreaterThan(worked);
  });

  it("the session is attributed to the START day, not the crossing day", () => {
    // The close instant lands on 2026-07-16, but the shift belongs to
    // 2026-07-15. The server keeps _session.work_date rather than deriving a day
    // from the threshold — proven here by the day components differing.
    const startDay = startedAt.toISOString().slice(0, 10);
    const crossingDay = threshold!.toISOString().slice(0, 10);
    expect(startDay).toBe("2026-07-15");
    expect(crossingDay).toBe("2026-07-16"); // different calendar day…
    expect(crossingDay).not.toBe(startDay); // …so "today at close time" would be wrong
  });

  it("a re-check-in after the close is a separate span, at the ordinary rate", () => {
    // The employee comes back at 04:00 and works an hour. That is a SECOND
    // work_sessions row for 2026-07-15; it accrues 1h of plain regular time and
    // is never measured against the daily target again.
    const topUpStart = iso("2026-07-16T04:00:00Z");
    const topUpEnd = iso("2026-07-16T05:00:00Z");
    expect(computeWorkedSeconds(topUpStart, topUpEnd, 0)).toBe(HOUR);
    // The day's total is the sum of both rows — what work_agg in payroll_report
    // computes — with no premium and, for part-time, no break credit either.
    expect(computeWorkedSeconds(startedAt, threshold!, 0) + HOUR).toBe(5 * HOUR);
  });
});

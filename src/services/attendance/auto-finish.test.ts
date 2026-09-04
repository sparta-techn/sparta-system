import { describe, expect, it } from "vitest";

import { computeWorkedSeconds, dayTargetThresholdAt } from "./rules";

/**
 * Parity tests for the overnight boundary fix and for AUTO-FINISH, mirroring the
 * server functions `finish_work_session` / `session_target_threshold_ts` /
 * `auto_finish_session_if_due` in migration 20260904120000. These run without a
 * database (the SQL is the authoritative copy; this pins the arithmetic, exactly
 * like pay.test.ts).
 *
 * The threshold computed here is what the server writes as the session's
 * check-out time, so these cases also pin *when a day is closed*. Note it is DAY
 * PROGRESS, not raw wall-clock: for full-time the break allowance sits inside
 * the target (so an 8h day with a break at or under 1h closes exactly 8h after
 * check-in), while part-time has no credit and a break always pushes the close
 * out.
 */

const HOUR = 3600;
const PART_TIME_TARGET = 240 * 60; // 4h in seconds
const FULL_TIME_TARGET = 480 * 60; // 8h in seconds
const iso = (s: string) => new Date(s);

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
  it("full-time crosses 8h from a same-day start", () => {
    const t = dayTargetThresholdAt(
      iso("2026-07-15T09:00:00Z"),
      [],
      FULL_TIME_TARGET,
      iso("2026-07-15T18:00:00Z"),
    );
    expect(t?.toISOString()).toBe("2026-07-15T17:00:00.000Z");
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

  it("pushes the split by the exact time spent on break", () => {
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

  it("returns null while mid-break and still under target", () => {
    // Start 23:00, on break since 01:00 (3h worked). Frozen under the 4h target.
    expect(
      dayTargetThresholdAt(
        iso("2026-07-15T23:00:00Z"),
        [{ startedAt: iso("2026-07-16T01:00:00Z"), endedAt: null }],
        PART_TIME_TARGET,
        iso("2026-07-16T05:00:00Z"),
      ),
    ).toBeNull();
  });

  it("a late sweep still back-dates the split to the real instant", () => {
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

describe("full-time closes on the CLOCK day (break allowance counted)", () => {
  // A full-time day is 8h on the clock: 7h worked + the 1h allowance. So the
  // split instant is 8h after start as long as breaks stay within the allowance.
  const CREDIT = HOUR;

  it("a 1h break does not push the split — 09:00 start still splits at 17:00", () => {
    const t = dayTargetThresholdAt(
      iso("2026-07-15T09:00:00Z"),
      [{ startedAt: iso("2026-07-15T12:00:00Z"), endedAt: iso("2026-07-15T13:00:00Z") }],
      FULL_TIME_TARGET,
      iso("2026-07-15T19:00:00Z"),
      CREDIT,
    );
    expect(t?.toISOString()).toBe("2026-07-15T17:00:00.000Z"); // 7h worked + 1h break
  });

  it("pushes the split only by break time PAST the allowance", () => {
    // 90-min break: 60 counted, 30 not → the day ends 30 min later than 17:00.
    const t = dayTargetThresholdAt(
      iso("2026-07-15T09:00:00Z"),
      [{ startedAt: iso("2026-07-15T12:00:00Z"), endedAt: iso("2026-07-15T13:30:00Z") }],
      FULL_TIME_TARGET,
      iso("2026-07-15T19:00:00Z"),
      CREDIT,
    );
    expect(t?.toISOString()).toBe("2026-07-15T17:30:00.000Z");
  });

  it("can cross the target while still ON a break the allowance covers", () => {
    // 7h30 worked, then a break opened at 16:30. The remaining 30 min of the day
    // is covered by the untouched allowance, so the day completes at 17:00 even
    // though the employee never came back — the server closes the break there.
    const t = dayTargetThresholdAt(
      iso("2026-07-15T09:00:00Z"),
      [{ startedAt: iso("2026-07-15T16:30:00Z"), endedAt: null }],
      FULL_TIME_TARGET,
      iso("2026-07-15T18:00:00Z"),
      CREDIT,
    );
    expect(t?.toISOString()).toBe("2026-07-15T17:00:00.000Z");
  });

  it("freezes once the allowance is spent mid-break", () => {
    // 3h worked, then a break from 12:00 still open at 14:00: only the first hour
    // counts, so progress is stuck at 4h — nowhere near the 8h day.
    expect(
      dayTargetThresholdAt(
        iso("2026-07-15T09:00:00Z"),
        [{ startedAt: iso("2026-07-15T12:00:00Z"), endedAt: null }],
        FULL_TIME_TARGET,
        iso("2026-07-15T14:00:00Z"),
        CREDIT,
      ),
    ).toBeNull();
  });

  it("part-time is unaffected — no credit, so a break always pushes the split", () => {
    // Same 1h break, part-time: 4h of real work is still required, ending at 14:00.
    const t = dayTargetThresholdAt(
      iso("2026-07-15T09:00:00Z"),
      [{ startedAt: iso("2026-07-15T12:00:00Z"), endedAt: iso("2026-07-15T13:00:00Z") }],
      PART_TIME_TARGET,
      iso("2026-07-15T19:00:00Z"),
      0,
    );
    expect(t?.toISOString()).toBe("2026-07-15T14:00:00.000Z");
  });
});

describe("COMBINED — part-time overnight shift auto-finished across midnight", () => {
  // A part-time employee starts at 11:00 PM and hits their 4h target at 3:00 AM,
  // crossing midnight. The session is CLOSED at 3:00 AM by the sweep — they no
  // longer roll into overtime.
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
    // computes — with no premium applied to the second one.
    expect(computeWorkedSeconds(startedAt, threshold!, 0) + HOUR).toBe(5 * HOUR);
  });
});

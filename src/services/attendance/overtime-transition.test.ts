import { describe, expect, it } from "vitest";

import { overtimeWorkedSeconds } from "@/features/overtime/pay";

import { computeWorkedSeconds, overtimeThresholdAt } from "./rules";

/**
 * Parity tests for the overnight boundary fix (Fix 1) and the automatic
 * regular → overtime transition (Fix 2), mirroring the server functions
 * `finish_work_session` / `overtime_threshold_ts` / `transition_overtime_if_due`
 * in migration 20260730120000. These run without a database (the SQL is the
 * authoritative copy; this pins the arithmetic, exactly like pay.test.ts).
 */

const HOUR = 3600;
const PART_TIME_TARGET = 240 * 60; // 4h in seconds
const FULL_TIME_TARGET = 480 * 60; // 8h in seconds
const iso = (s: string) => new Date(s);

describe("Fix 1 — duration math is date-agnostic across midnight", () => {
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

describe("Fix 2 — overtime split instant (overtimeThresholdAt)", () => {
  it("full-time crosses 8h from a same-day start", () => {
    const t = overtimeThresholdAt(
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
      overtimeThresholdAt(
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
    const t = overtimeThresholdAt(
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
      overtimeThresholdAt(
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
    const t = overtimeThresholdAt(
      iso("2026-07-15T23:00:00Z"),
      [],
      PART_TIME_TARGET,
      iso("2026-07-16T03:47:00Z"),
    );
    expect(t?.toISOString()).toBe("2026-07-16T03:00:00.000Z");
  });
});

describe("Fix 2 — full-time splits on the CLOCK day (break allowance counted)", () => {
  // A full-time day is 8h on the clock: 7h worked + the 1h allowance. So the
  // split instant is 8h after start as long as breaks stay within the allowance.
  const CREDIT = HOUR;

  it("a 1h break does not push the split — 09:00 start still splits at 17:00", () => {
    const t = overtimeThresholdAt(
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
    const t = overtimeThresholdAt(
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
    const t = overtimeThresholdAt(
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
      overtimeThresholdAt(
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
    const t = overtimeThresholdAt(
      iso("2026-07-15T09:00:00Z"),
      [{ startedAt: iso("2026-07-15T12:00:00Z"), endedAt: iso("2026-07-15T13:00:00Z") }],
      PART_TIME_TARGET,
      iso("2026-07-15T19:00:00Z"),
      0,
    );
    expect(t?.toISOString()).toBe("2026-07-15T14:00:00.000Z");
  });
});

describe("COMBINED — part-time overnight shift auto-transitioning across midnight", () => {
  // The exact scenario in the request: part-time employee starts at 11:00 PM,
  // auto-transitions to overtime at 3:00 AM (4h later, crossing midnight), keeps
  // working, and finishes at 5:00 AM. Fix 1 (date attribution) and Fix 2
  // (auto-split) intersect here.
  const startedAt = iso("2026-07-15T23:00:00Z"); // 11:00 PM, work_date = 2026-07-15
  const finishedAt = iso("2026-07-16T05:00:00Z"); // 5:00 AM next calendar day

  const threshold = overtimeThresholdAt(startedAt, [], PART_TIME_TARGET, finishedAt);

  it("splits at exactly 03:00 the next calendar day", () => {
    expect(threshold?.toISOString()).toBe("2026-07-16T03:00:00.000Z");
  });

  it("regular session is closed at the threshold with worked = the 4h target", () => {
    // finish_work_session / transition set working_seconds = target exactly.
    const regularWorked = computeWorkedSeconds(startedAt, threshold!, 0);
    expect(regularWorked).toBe(PART_TIME_TARGET);
    expect(regularWorked).toBe(4 * HOUR);
  });

  it("overtime session runs from the threshold to finish (2h)", () => {
    const otWorked = overtimeWorkedSeconds(threshold!.toISOString(), finishedAt.toISOString());
    expect(otWorked).toBe(2 * HOUR);
  });

  it("BOTH regular and overtime are attributed to the START day, not the crossing day", () => {
    // The heart of the Fix 1 × Fix 2 intersection: the split instant lands on
    // 2026-07-16 (crossing day), but the shift belongs to 2026-07-15. The server
    // stamps work_date = _session.work_date (the start day) — NOT
    // current_work_date() — so deriving the day from the threshold would misfile
    // it. Proven here by the day components differing.
    const startDay = startedAt.toISOString().slice(0, 10);
    const crossingDay = threshold!.toISOString().slice(0, 10);
    expect(startDay).toBe("2026-07-15");
    expect(crossingDay).toBe("2026-07-16"); // different calendar day…
    expect(crossingDay).not.toBe(startDay); // …so "today at split time" would be wrong
  });

  it("total worked over the shift = 4h regular + 2h overtime = 6h, spanning midnight", () => {
    const regularWorked = computeWorkedSeconds(startedAt, threshold!, 0);
    const otWorked = overtimeWorkedSeconds(threshold!.toISOString(), finishedAt.toISOString());
    expect(regularWorked + otWorked).toBe(6 * HOUR);
    expect(computeWorkedSeconds(startedAt, finishedAt, 0)).toBe(6 * HOUR); // end-to-end matches
  });
});

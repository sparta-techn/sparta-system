import { describe, expect, it } from "vitest";

import {
  attendanceStatusForCheckIn,
  breakLimitExceeded,
  classifyCompletedDay,
  computeWorkedSeconds,
  DEFAULT_ATTENDANCE_POLICY,
  isLate,
  lateMinutes,
  lateThresholdMinutes,
  netWorkTargetSeconds,
  overtimeSeconds,
  remainingBreakSeconds,
} from "./rules";

/** Build a Date at a fixed local time-of-day (date component is irrelevant). */
function at(h: number, m = 0): Date {
  return new Date(2026, 5, 30, h, m, 0, 0);
}

const HOUR = 3600;

describe("working hours start at 09:00 + grace until 10:00", () => {
  it("treats the on-time window (09:00–10:00) as on_time", () => {
    expect(isLate(at(8, 45))).toBe(false); // early
    expect(isLate(at(9, 0))).toBe(false); // exactly on start
    expect(isLate(at(9, 30))).toBe(false); // within grace
    expect(isLate(at(10, 0))).toBe(false); // last on-time minute
  });

  it("marks check-in after 10:00 as Late", () => {
    expect(isLate(at(10, 1))).toBe(true);
    expect(isLate(at(11, 0))).toBe(true);
  });

  it("exposes the 10:00 threshold as minutes-of-day", () => {
    expect(lateThresholdMinutes()).toBe(10 * 60); // 600 = 10:00
  });

  it("counts late minutes from 09:00 (0 when early)", () => {
    expect(lateMinutes(at(8, 30))).toBe(0);
    expect(lateMinutes(at(9, 0))).toBe(0);
    expect(lateMinutes(at(9, 45))).toBe(45);
    expect(lateMinutes(at(10, 0))).toBe(60);
    expect(lateMinutes(at(10, 1))).toBe(61);
  });
});

describe("attendance status from check-in", () => {
  it("is on_time within the grace window and late after 10:00", () => {
    expect(attendanceStatusForCheckIn(at(9, 30))).toBe("on_time");
    expect(attendanceStatusForCheckIn(at(10, 0))).toBe("on_time");
    expect(attendanceStatusForCheckIn(at(10, 30))).toBe("late");
  });

  it("marks no check-in on a working day as absent", () => {
    expect(attendanceStatusForCheckIn(null)).toBe("absent");
  });

  it("short-circuits on weekend / holiday / leave", () => {
    expect(attendanceStatusForCheckIn(at(11, 0), { isWeekend: true })).toBe("weekend");
    expect(attendanceStatusForCheckIn(null, { isHoliday: true })).toBe("holiday");
    expect(attendanceStatusForCheckIn(null, { onLeave: true })).toBe("leave");
  });
});

describe("working duration is 8 hours", () => {
  it("computes net worked seconds (gross minus break)", () => {
    expect(computeWorkedSeconds(at(9, 0), at(17, 0), HOUR)).toBe(7 * HOUR); // 8h span − 1h break
    expect(computeWorkedSeconds(at(9, 0), at(17, 0), 0)).toBe(8 * HOUR);
    expect(computeWorkedSeconds(at(17, 0), at(9, 0), 0)).toBe(0); // never negative
  });

  it("accrues overtime only beyond 8 hours", () => {
    expect(overtimeSeconds(8 * HOUR)).toBe(0);
    expect(overtimeSeconds(7 * HOUR)).toBe(0);
    expect(overtimeSeconds(8 * HOUR + 1800)).toBe(1800); // +30m overtime
  });

  it("classifies the completed day on net working time", () => {
    // Half of the 7h that has to be WORKED is 3h30, not half the 8h paid day.
    expect(classifyCompletedDay(7 * HOUR, 0)).toBe("on_time");
    expect(classifyCompletedDay(7 * HOUR, 90)).toBe("late"); // late beats full day
    expect(classifyCompletedDay(4 * HOUR, 0)).toBe("on_time"); // over 3h30 worked
    expect(classifyCompletedDay(3 * HOUR, 0)).toBe("half_day"); // under 3h30 worked
  });
});

describe("the day is worked in net time; the break hour is paid, not worked", () => {
  it("puts the working target an hour under the scheduled day", () => {
    expect(netWorkTargetSeconds()).toBe(7 * HOUR);
    expect(DEFAULT_ATTENDANCE_POLICY.expectedWorkMinutes * 60).toBe(8 * HOUR);
  });

  it("derives the target from company settings, not a hardcoded 7h", () => {
    expect(netWorkTargetSeconds({ ...DEFAULT_ATTENDANCE_POLICY, expectedWorkMinutes: 540 })).toBe(
      8 * HOUR,
    ); // 9h day − 1h allowance
    expect(netWorkTargetSeconds({ ...DEFAULT_ATTENDANCE_POLICY, maxBreakMinutes: 30 })).toBe(
      7.5 * HOUR,
    );
  });

  it("reaches the target on 7h of work whether or not a break is taken", () => {
    // Took the full hour: 8h on the clock, 7h of it worked.
    expect(computeWorkedSeconds(at(9), at(17), HOUR)).toBe(netWorkTargetSeconds());
    // Skipped the break entirely: the same 7h of work, reached an hour earlier.
    expect(computeWorkedSeconds(at(9), at(16), 0)).toBe(netWorkTargetSeconds());
    // Took two hours: still 7h worked, the day just ends later on the clock.
    expect(computeWorkedSeconds(at(9), at(18), 2 * HOUR)).toBe(netWorkTargetSeconds());
  });

  it("leaves the retired overtime helper measuring the old clock day", () => {
    // Nothing live computes this any more; historical rows are reproduced from
    // day progress (worked + credited break), which is why 8h is still the line.
    expect(overtimeSeconds(8 * HOUR)).toBe(0);
    expect(overtimeSeconds(8 * HOUR + 1800)).toBe(1800);
  });
});

describe("break duration is capped at 1 hour", () => {
  it("reports the remaining break budget", () => {
    expect(remainingBreakSeconds(0)).toBe(HOUR);
    expect(remainingBreakSeconds(1800)).toBe(1800);
    expect(remainingBreakSeconds(HOUR)).toBe(0);
    expect(remainingBreakSeconds(HOUR + 600)).toBe(0); // clamped at 0
  });

  it("flags breaks that exceed the 1-hour cap", () => {
    expect(breakLimitExceeded(1800)).toBe(false);
    expect(breakLimitExceeded(HOUR)).toBe(false); // exactly 1h is allowed
    expect(breakLimitExceeded(HOUR + 1)).toBe(true);
  });
});

describe("policy defaults match the seeded company_settings", () => {
  it("is 09:00 start / 60-min grace / 480-min day / 60-min break", () => {
    expect(DEFAULT_ATTENDANCE_POLICY).toEqual({
      workStart: "09:00",
      graceMinutes: 60,
      expectedWorkMinutes: 480,
      maxBreakMinutes: 60,
    });
  });
});

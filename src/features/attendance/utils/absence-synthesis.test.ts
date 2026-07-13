import { describe, expect, it } from "vitest";

import type { HrEmployee } from "@/features/hr/mock-data";
import { synthesizeAbsences, type SynthesizeAbsencesArgs } from "./absence-synthesis";
import type { TeammateToday } from "../api";

/** A minimal roster employee; overrides tweak the fields the synth cares about. */
function emp(overrides: Partial<HrEmployee> = {}): HrEmployee {
  return {
    id: overrides.id ?? "e-1",
    userId: "u-1",
    name: "Amira Hassan",
    initials: "AH",
    email: "amira@x.co",
    avatarHue: 0,
    department: "Engineering" as HrEmployee["department"],
    team: "Core",
    jobTitle: "Engineer",
    role: "employee",
    status: "active",
    managerId: null,
    joinedAt: "2020-01-01",
    birthday: "01-01",
    location: "Cairo",
    timezone: "Africa/Cairo",
    employmentType: "Full-time",
    workMode: "Remote",
    ...overrides,
  } as HrEmployee;
}

/** A real session row for `userId` on `date`. */
function session(userId: string, date: string): TeammateToday {
  return {
    session: {
      id: `s-${userId}-${date}`,
      user_id: userId,
      work_date: date,
      started_at: `${date}T09:00:00Z`,
      finished_at: `${date}T17:00:00Z`,
      break_seconds: 0,
      working_seconds: 28800,
      overtime_seconds: 0,
      late_minutes: 0,
      attendance_status: "on_time",
      session_status: "finished",
      browser: null,
      device: null,
      ip: null,
      location: null,
      notes: null,
      timezone: null,
      created_at: "",
      updated_at: "",
    } as TeammateToday["session"],
    profile: {
      id: userId,
      full_name: "Amira Hassan",
      display_name: "Amira Hassan",
      avatar_url: null,
      job_title: "Engineer",
    },
  };
}

// Base args: a full Mon–Fri week (Sun/Sat weekend) with "today" past the range
// so the whole range is eligible.
function baseArgs(overrides: Partial<SynthesizeAbsencesArgs> = {}): SynthesizeAbsencesArgs {
  return {
    sessions: [],
    roster: [emp()],
    from: "2026-07-06", // Monday
    to: "2026-07-10", // Friday
    today: "2026-07-20", // well after range
    weekendDays: [0, 6], // Sun, Sat
    holidays: new Set<string>(),
    ...overrides,
  };
}

describe("synthesizeAbsences", () => {
  it("marks every working day absent when there are no sessions", () => {
    const rows = synthesizeAbsences(baseArgs());
    expect(rows).toHaveLength(5); // Mon–Fri
    expect(rows.every((r) => r.synthetic && r.session.attendance_status === "absent")).toBe(true);
    expect(rows.map((r) => r.session.work_date)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
    ]);
  });

  it("skips days the employee already has a session for", () => {
    const rows = synthesizeAbsences(
      baseArgs({ sessions: [session("u-1", "2026-07-07"), session("u-1", "2026-07-09")] }),
    );
    expect(rows.map((r) => r.session.work_date)).toEqual([
      "2026-07-06",
      "2026-07-08",
      "2026-07-10",
    ]);
  });

  it("excludes weekend days", () => {
    const rows = synthesizeAbsences(baseArgs({ from: "2026-07-06", to: "2026-07-12" }));
    // Sat 11th + Sun 12th excluded.
    expect(rows.map((r) => r.session.work_date)).not.toContain("2026-07-11");
    expect(rows.map((r) => r.session.work_date)).not.toContain("2026-07-12");
    expect(rows).toHaveLength(5);
  });

  it("excludes full-day holidays", () => {
    const rows = synthesizeAbsences(baseArgs({ holidays: new Set(["2026-07-08"]) }));
    expect(rows.map((r) => r.session.work_date)).not.toContain("2026-07-08");
    expect(rows).toHaveLength(4);
  });

  it("does not mark days before the hire date", () => {
    const rows = synthesizeAbsences(baseArgs({ roster: [emp({ joinedAt: "2026-07-08" })] }));
    expect(rows.map((r) => r.session.work_date)).toEqual([
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
    ]);
  });

  it("stops absences the day before today", () => {
    const rows = synthesizeAbsences(baseArgs({ today: "2026-07-08" }));
    // Only Mon 6th + Tue 7th are strictly before today (8th).
    expect(rows.map((r) => r.session.work_date)).toEqual(["2026-07-06", "2026-07-07"]);
  });

  it("skips part-timers entirely", () => {
    const rows = synthesizeAbsences(baseArgs({ roster: [emp({ employmentType: "Part-time" })] }));
    expect(rows).toHaveLength(0);
  });

  it("skips non-active employees and those without a linked account", () => {
    const rows = synthesizeAbsences(
      baseArgs({
        roster: [emp({ status: "on_leave" }), emp({ userId: undefined })],
      }),
    );
    expect(rows).toHaveLength(0);
  });

  it("returns nothing when the whole range is in the future", () => {
    const rows = synthesizeAbsences(baseArgs({ today: "2026-07-01" }));
    expect(rows).toHaveLength(0);
  });
});

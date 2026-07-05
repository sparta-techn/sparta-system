/**
 * Time Tracking source — tracked working time from work sessions.
 *
 * A dedicated `time_logs` service does not exist yet; the tracked-time signal
 * available in the service layer today is the attendance **work session**
 * (`duration_seconds`). This source reads those durations. When a first-class
 * time-tracking service lands, swap the fetch below — the fragment shape and
 * every consumer stay the same.
 */

import { attendanceSessionsService } from "@/services";
import type { AttendanceSession } from "@/services/attendance/types";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, formatDuration, fragment } from "./source-utils";

export const timeTrackingSource: ContextSource = {
  key: "time_tracking",
  label: "Time Tracking",

  async gather({ userId }) {
    const sessions = await attendanceSessionsService.listByUser(userId, {
      limit: 10,
      orderBy: "work_date",
      direction: "desc",
    });

    if (sessions.length === 0) {
      return emptyFragment("time_tracking", this.label, "No tracked time on record.");
    }

    // Roll up total tracked seconds per work date.
    const byDate = new Map<string, number>();
    for (const s of sessions) {
      byDate.set(s.work_date, (byDate.get(s.work_date) ?? 0) + (s.duration_seconds ?? 0));
    }

    const rows = [...byDate.entries()].map<[string, number]>(([date, secs]) => [date, secs]);
    const { items, truncated } = clampList(rows, 5);

    const entities: ContextEntity[] = items.map(([date, secs]) => ({
      type: "time_tracking",
      id: `${userId}:${date}`,
      ref: date,
      summary: `Tracked ${formatDuration(secs)} on ${date}`,
    }));

    return fragment("time_tracking", this.label, entities, { truncated });
  },
};

/** Exposed for reuse/testing — total tracked seconds across sessions. */
export function totalTrackedSeconds(sessions: AttendanceSession[]): number {
  return sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
}

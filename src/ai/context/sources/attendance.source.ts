/**
 * Attendance source — today's attendance record and any active work session.
 * Reads through the attendance services; RLS scopes rows to the caller.
 */

import { attendanceRecordsService, attendanceSessionsService } from "@/services";
import type { ContextEntity, ContextSource } from "../../types";
import { emptyFragment, formatDuration, fragment, resolveWorkDate } from "./source-utils";

export const attendanceSource: ContextSource = {
  key: "attendance",
  label: "Attendance",

  async gather({ userId, hints }) {
    const workDate = resolveWorkDate(hints);
    const [record, active] = await Promise.all([
      attendanceRecordsService.getByDate(userId, workDate),
      attendanceSessionsService.getActive(userId, workDate),
    ]);

    const entities: ContextEntity[] = [];

    if (record) {
      const bits = [
        `status: ${record.status}`,
        record.late_minutes > 0 ? `late: ${record.late_minutes}m` : null,
        `worked: ${formatDuration(record.worked_seconds)}`,
        record.break_seconds > 0 ? `breaks: ${formatDuration(record.break_seconds)}` : null,
        record.overtime_seconds > 0 ? `overtime: ${formatDuration(record.overtime_seconds)}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      entities.push({
        type: "attendance",
        id: record.id,
        ref: workDate,
        summary: `Attendance ${workDate} — ${bits}`,
      });
    }

    if (active) {
      entities.push({
        type: "work_session",
        id: active.id,
        summary: `Active session since ${active.started_at} (status: ${active.status})`,
      });
    }

    if (entities.length === 0) {
      return emptyFragment("attendance", this.label, `No attendance recorded for ${workDate}.`);
    }
    return fragment("attendance", this.label, entities);
  },
};

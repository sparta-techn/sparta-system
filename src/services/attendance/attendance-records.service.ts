import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { AttendanceRecord, AttendanceRecordInsert, AttendanceRecordUpdate } from "./types";

/**
 * AttendanceRecordsService — the daily attendance record (`public.attendance`).
 *
 * One row per `(user_id, work_date)`. Holds the day-level rollup
 * (first check-in, last check-out, late / worked / break / overtime totals).
 * Session and break detail live in their own services; the
 * {@link AttendanceRepository} composes all of them for the lifecycle verbs.
 */
export class AttendanceRecordsService extends BaseService<
  AttendanceRecord,
  AttendanceRecordInsert,
  AttendanceRecordUpdate
> {
  protected readonly table = "attendance";
  protected readonly entity = "Attendance record";
  protected readonly defaultOrderBy = "work_date";

  /** The attendance record for a user on a given work date, or `null`. */
  async getByDate(userId: string, workDate: string): Promise<AttendanceRecord | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("user_id", userId)
        .eq("work_date", workDate)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AttendanceRecord | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Get the record for the date, creating it if absent (idempotent). */
  async ensureForDate(
    userId: string,
    workDate: string,
    seed: Partial<AttendanceRecordInsert> = {},
  ): Promise<AttendanceRecord> {
    const existing = await this.getByDate(userId, workDate);
    if (existing) return existing;
    return this.create({ user_id: userId, work_date: workDate, ...seed });
  }

  /** A user's attendance history (most recent first). */
  listByUser(
    userId: string,
    params: ListParams<AttendanceRecord> = {},
  ): Promise<AttendanceRecord[]> {
    return this.list({ ...params, filters: { ...params.filters, user_id: userId } });
  }

  /** Everyone's attendance for a work date (manager / HR roll-up). */
  listByDate(
    workDate: string,
    params: ListParams<AttendanceRecord> = {},
  ): Promise<AttendanceRecord[]> {
    return this.list({ ...params, filters: { ...params.filters, work_date: workDate } });
  }
}

/** Shared singleton — import this, not the class. */
export const attendanceRecordsService = new AttendanceRecordsService();

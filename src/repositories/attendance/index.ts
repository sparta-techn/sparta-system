/**
 * Attendance repository (new schema).
 *
 * Domain-facing lifecycle over the `attendance` / `attendance_sessions` /
 * `break_sessions` / `attendance_events` tables (migration 20260630130000).
 * Import the singleton from `@/repositories/attendance`.
 *
 * NOTE: intentionally NOT re-exported from the root `@/repositories` barrel —
 * the root `AttendanceRepository` (over the live `work_sessions` RPCs) keeps
 * that name. Same convention as the HR repositories under `@/repositories/hr`.
 */
export { AttendanceRepository, attendanceRepository } from "./attendance.repository";
export type { AttendanceDay } from "./attendance.repository";

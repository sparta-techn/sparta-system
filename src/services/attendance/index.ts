// Existing RPC-backed service over the live `work_sessions` schema.
export { AttendanceService, attendanceService } from "./attendance.service";

// New services over the `attendance` / `attendance_sessions` / `break_sessions`
// / `attendance_events` tables (migration 20260630130000).
export { AttendanceRecordsService, attendanceRecordsService } from "./attendance-records.service";
export {
  AttendanceSessionsService,
  attendanceSessionsService,
} from "./attendance-sessions.service";
export { BreakSessionsService, breakSessionsService } from "./break-sessions.service";
export { AttendanceEventsService, attendanceEventsService } from "./attendance-events.service";

export type {
  AttendanceRecord,
  AttendanceRecordInsert,
  AttendanceRecordUpdate,
  AttendanceSession,
  AttendanceSessionInsert,
  AttendanceSessionUpdate,
  BreakSession,
  BreakSessionInsert,
  BreakSessionUpdate,
  AttendanceEvent,
  AttendanceEventInsert,
  AttendanceEventType,
  AttendanceStatus,
  WorkSessionStatus,
  SessionContext,
} from "./types";

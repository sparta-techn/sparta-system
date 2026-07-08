import { StatusBadge } from "@/components/status-badge";
import { ATTENDANCE_STATUS_META, SESSION_STATUS_META } from "../types";
import type { AttendanceStatus, WorkSessionStatus } from "../types";

export function AttendanceBadge({
  status,
  size,
}: {
  status: AttendanceStatus;
  size?: "sm" | "md" | "lg";
}) {
  const meta = ATTENDANCE_STATUS_META[status];
  return <StatusBadge tone={meta.tone} label={meta.label} size={size} />;
}

export function SessionStatusBadge({
  status,
  size,
}: {
  status: WorkSessionStatus;
  size?: "sm" | "md" | "lg";
}) {
  const meta = SESSION_STATUS_META[status];
  return <StatusBadge tone={meta.tone} label={meta.label} size={size} />;
}

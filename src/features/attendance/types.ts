import type { Database } from "@/integrations/supabase/types";

export type WorkSessionStatus = Database["public"]["Enums"]["work_session_status"];
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
export type CompanySettings = Database["public"]["Tables"]["company_settings"]["Row"];
export type WorkSessionRow = Database["public"]["Tables"]["work_sessions"]["Row"];
export type WorkSessionBreakRow = Database["public"]["Tables"]["work_session_breaks"]["Row"];

export interface TodaySession {
  session: WorkSessionRow | null;
  breaks: WorkSessionBreakRow[];
  workDate: string;
}

export interface AttendanceStatusMeta {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info" | "primary";
}

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, AttendanceStatusMeta> = {
  in_progress: { label: "In progress", tone: "info" },
  on_time: { label: "On time", tone: "success" },
  late: { label: "Late", tone: "warning" },
  absent: { label: "Absent", tone: "danger" },
  weekend: { label: "Weekend", tone: "neutral" },
  holiday: { label: "Holiday", tone: "primary" },
  half_day: { label: "Half day", tone: "warning" },
  leave: { label: "Leave", tone: "info" },
};

export const SESSION_STATUS_META: Record<
  WorkSessionStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "info" | "primary" }
> = {
  not_started: { label: "Not started", tone: "neutral" },
  working: { label: "Working", tone: "success" },
  on_break: { label: "On break", tone: "info" },
  finished: { label: "Finished", tone: "primary" },
};

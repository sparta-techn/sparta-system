import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AttendanceExceptionRow = Database["public"]["Tables"]["attendance_exceptions"]["Row"];

/**
 * An attendance exception enriched with the subject's auth `user_id` (via
 * `employees.user_id`). Work sessions are keyed by `user_id`, so this lets us
 * match exceptions onto attendance rows by `user_id + date`.
 */
export interface AttendanceException extends AttendanceExceptionRow {
  userId: string | null;
}

export interface CreateExceptionInput {
  employeeId: string;
  date: string; // YYYY-MM-DD
  reason: string;
  paid: boolean;
  adjustmentMinutes: number;
}

export interface UpdateExceptionInput {
  reason: string;
  paid: boolean;
  adjustmentMinutes: number;
}

/**
 * Log an exception. Writes are gated to Manager/HR/Admin/Owner by RLS
 * (`attendance_exceptions_manager_write`); `created_by` defaults to `auth.uid()`.
 */
export async function createAttendanceException(
  input: CreateExceptionInput,
): Promise<AttendanceExceptionRow> {
  const { data, error } = await supabase
    .from("attendance_exceptions")
    .insert({
      employee_id: input.employeeId,
      exception_date: input.date,
      reason: input.reason,
      paid: input.paid,
      adjustment_minutes: input.adjustmentMinutes,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAttendanceException(
  id: string,
  patch: UpdateExceptionInput,
): Promise<AttendanceExceptionRow> {
  const { data, error } = await supabase
    .from("attendance_exceptions")
    .update({
      reason: patch.reason,
      paid: patch.paid,
      adjustment_minutes: patch.adjustmentMinutes,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttendanceException(id: string): Promise<void> {
  const { error } = await supabase.from("attendance_exceptions").delete().eq("id", id);
  if (error) throw error;
}

const SELECT = "*, employee:employees!attendance_exceptions_employee_id_fkey(user_id)";

/**
 * Attendance exceptions whose `exception_date` falls in `[from, to]`
 * (`YYYY-MM-DD`). RLS scopes the result: reviewers see everyone's, a plain
 * employee sees only their own. Enriched with each subject's `user_id`.
 */
export async function getAttendanceExceptionsInRange(
  from: string,
  to: string,
): Promise<AttendanceException[]> {
  const { data, error } = await supabase
    .from("attendance_exceptions")
    .select(SELECT)
    .gte("exception_date", from)
    .lte("exception_date", to)
    .order("exception_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { employee, ...rest } = row as AttendanceExceptionRow & {
      employee: { user_id: string } | null;
    };
    return { ...(rest as AttendanceExceptionRow), userId: employee?.user_id ?? null };
  });
}

/** Key an exception onto a `work_sessions` row: `${user_id}|${YYYY-MM-DD}`. */
export function exceptionKeyFor(userId: string, date: string): string {
  return `${userId}|${date}`;
}

/** Group exceptions by `user_id|date` for O(1) lookup against attendance rows. */
export function exceptionsByUserDate(
  list: AttendanceException[],
): Map<string, AttendanceException[]> {
  const map = new Map<string, AttendanceException[]>();
  for (const ex of list) {
    if (!ex.userId) continue;
    const key = exceptionKeyFor(ex.userId, ex.exception_date);
    const bucket = map.get(key);
    if (bucket) bucket.push(ex);
    else map.set(key, [ex]);
  }
  return map;
}

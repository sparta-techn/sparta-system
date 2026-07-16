import { supabase } from "@/integrations/supabase/client";
import { getCurrentWorkDate } from "@/features/attendance/api";

import type { OvertimePayLine, OvertimeQueueRow, OvertimeSession } from "./types";

// ── Employee state-machine actions (all via SECURITY DEFINER RPCs) ──────────

export async function startOvertime(notes?: string): Promise<OvertimeSession> {
  const { data, error } = await supabase.rpc("start_overtime_session", {
    _notes: notes ?? undefined,
  });
  if (error) throw error;
  return data as unknown as OvertimeSession;
}

export async function finishOvertime(): Promise<OvertimeSession> {
  const { data, error } = await supabase.rpc("finish_overtime_session");
  if (error) throw error;
  return data as unknown as OvertimeSession;
}

// ── Manager actions ─────────────────────────────────────────────────────────

export async function requestOvertime(
  employeeId: string,
  workDate: string,
  notes?: string,
): Promise<OvertimeSession> {
  const { data, error } = await supabase.rpc("request_overtime_session", {
    _employee_id: employeeId,
    _work_date: workDate,
    _notes: notes ?? undefined,
  });
  if (error) throw error;
  return data as unknown as OvertimeSession;
}

export async function approveOvertime(sessionId: string, note?: string): Promise<OvertimeSession> {
  const { data, error } = await supabase.rpc("approve_overtime_session", {
    _session_id: sessionId,
    _note: note ?? undefined,
  });
  if (error) throw error;
  return data as unknown as OvertimeSession;
}

export async function rejectOvertime(sessionId: string, reason: string): Promise<OvertimeSession> {
  const { data, error } = await supabase.rpc("reject_overtime_session", {
    _session_id: sessionId,
    _reason: reason,
  });
  if (error) throw error;
  return data as unknown as OvertimeSession;
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** The caller's own `employees.id`, or null if they have no employee record. */
export async function getCurrentEmployeeId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_employee_id");
  if (error) throw error;
  return (data as unknown as string) ?? null;
}

/**
 * The current user's overtime session for today, if any (open or logged).
 * Scoped by the caller's own employee id so a manager viewing their own card
 * doesn't pick up teammates' rows.
 */
export async function getMyTodayOvertime(): Promise<OvertimeSession | null> {
  const [employeeId, workDate] = await Promise.all([getCurrentEmployeeId(), getCurrentWorkDate()]);
  if (!employeeId) return null;
  const { data, error } = await supabase
    .from("overtime_sessions")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

const QUEUE_SELECT =
  "*, employee:employees!overtime_sessions_employee_id_fkey(" +
  "id, employee_code, " +
  "profile:profiles!employees_user_id_fkey(full_name, display_name, avatar_url), " +
  "employment_type:employment_types!employees_employment_type_id_fkey(slug))";

interface RawQueueRow extends OvertimeSession {
  employee: {
    id: string;
    employee_code: string | null;
    profile: {
      full_name: string | null;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
    employment_type: { slug: string | null } | null;
  } | null;
}

function reshapeQueueRows(data: unknown[] | null): OvertimeQueueRow[] {
  return (data ?? []).flatMap((row) => {
    const { employee, ...session } = row as RawQueueRow;
    if (!employee) return [];
    return [
      {
        session: session as OvertimeSession,
        employee: {
          id: employee.id,
          employee_code: employee.employee_code,
          full_name: employee.profile?.full_name ?? null,
          display_name: employee.profile?.display_name ?? null,
          avatar_url: employee.profile?.avatar_url ?? null,
          employment_type_slug: employee.employment_type?.slug ?? null,
        },
      },
    ];
  });
}

/**
 * Pending overtime sessions that have been logged (finished) and are awaiting a
 * decision — the manager approval queue. Reviewer RLS returns every employee's
 * rows; plain employees never call this. Newest logged first.
 */
export async function getPendingOvertimeQueue(): Promise<OvertimeQueueRow[]> {
  const { data, error } = await supabase
    .from("overtime_sessions")
    .select(QUEUE_SELECT)
    .eq("status", "pending")
    .not("end_time", "is", null)
    .order("end_time", { ascending: true });
  if (error) throw error;
  return reshapeQueueRows(data as unknown[]);
}

/**
 * Authoritative overtime pay lines for an employee over `[from, to]` — the SAME
 * server function the Phase-4 export reads. Gated to `payroll.view`; throws for
 * callers without it.
 */
export async function getOvertimePayReport(
  employeeId: string,
  from: string,
  to: string,
): Promise<OvertimePayLine[]> {
  const { data, error } = await supabase.rpc("overtime_pay_report", {
    _employee_id: employeeId,
    _from: from,
    _to: to,
  });
  if (error) throw error;
  return (data as unknown as OvertimePayLine[]) ?? [];
}

export interface OvertimePaySummaryRow {
  employeeId: string;
  name: string;
  sessionCount: number;
  totalAmount: number;
  currency: string;
}

/**
 * Per-employee approved-overtime pay totals for `[from, to]`, each employee's
 * total sourced from the authoritative `overtime_pay_report` RPC (never a
 * client re-computation). Payroll.view gated. Sorted by total, highest first.
 */
export async function getOvertimePayMonthSummary(
  from: string,
  to: string,
): Promise<OvertimePaySummaryRow[]> {
  // Which employees have approved overtime in range (+ their display name).
  const { data, error } = await supabase
    .from("overtime_sessions")
    .select(QUEUE_SELECT)
    .eq("status", "approved")
    .gte("work_date", from)
    .lte("work_date", to);
  if (error) throw error;
  const byEmployee = new Map<string, string>();
  for (const row of reshapeQueueRows(data as unknown[])) {
    byEmployee.set(
      row.employee.id,
      row.employee.display_name ?? row.employee.full_name ?? "Unknown",
    );
  }

  const rows = await Promise.all(
    [...byEmployee.entries()].map(async ([employeeId, name]) => {
      const lines = await getOvertimePayReport(employeeId, from, to);
      const totalAmount = lines.reduce((sum, l) => sum + Number(l.amount ?? 0), 0);
      return {
        employeeId,
        name,
        sessionCount: lines.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        currency: lines[0]?.currency ?? "EGP",
      };
    }),
  );
  return rows.sort((a, b) => b.totalAmount - a.totalAmount);
}

import { supabase } from "@/integrations/supabase/client";
import { fetchHrEmployees } from "@/features/hr/api";
import type { CompanySettings, TodaySession, WorkSessionBreakRow, WorkSessionRow } from "./types";
import { synthesizeAbsences, type TeamAttendanceRow } from "./utils/absence-synthesis";

export type { TeamAttendanceRow };

/** Detect a friendly browser label from UA string. */
function detectBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Other";
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad/.test(ua)) return "mobile";
  return "desktop";
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data;
}

export async function getCurrentWorkDate(): Promise<string> {
  const { data, error } = await supabase.rpc("current_work_date");
  if (error) throw error;
  return data as unknown as string;
}

export async function getTodaySession(userId: string): Promise<TodaySession> {
  const workDate = await getCurrentWorkDate();
  const { data: session, error } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw error;

  let breaks: WorkSessionBreakRow[] = [];
  if (session) {
    const { data: brk, error: bErr } = await supabase
      .from("work_session_breaks")
      .select("*")
      .eq("session_id", session.id)
      .order("started_at", { ascending: true });
    if (bErr) throw bErr;
    breaks = brk ?? [];
  }
  return { session: session ?? null, breaks, workDate };
}

export async function startWork(): Promise<WorkSessionRow> {
  const { data, error } = await supabase.rpc("start_work_session", {
    _device: detectDevice(),
    _browser: detectBrowser(),
  });
  if (error) throw error;
  return data as unknown as WorkSessionRow;
}

export async function startBreak(): Promise<WorkSessionBreakRow> {
  const { data, error } = await supabase.rpc("start_break");
  if (error) throw error;
  return data as unknown as WorkSessionBreakRow;
}

export async function endBreak(): Promise<WorkSessionBreakRow> {
  const { data, error } = await supabase.rpc("end_break");
  if (error) throw error;
  return data as unknown as WorkSessionBreakRow;
}

export async function finishWork(): Promise<WorkSessionRow> {
  const { data, error } = await supabase.rpc("finish_work_session");
  if (error) throw error;
  return data as unknown as WorkSessionRow;
}

export interface HistoryFilters {
  status?: string | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  page: number;
  pageSize: number;
}

export interface HistoryPage {
  rows: WorkSessionRow[];
  count: number;
}

export async function getAttendanceHistory(
  userId: string,
  filters: HistoryFilters,
): Promise<HistoryPage> {
  const from = filters.page * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let q = supabase
    .from("work_sessions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("work_date", { ascending: false })
    .range(from, to);

  if (filters.status) {
    // typed via TS — caller passes a real attendance status
    q = q.eq("attendance_status", filters.status as never);
  }
  if (filters.from) q = q.gte("work_date", filters.from);
  if (filters.to) q = q.lte("work_date", filters.to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export interface TeammateToday {
  session: WorkSessionRow;
  profile: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    job_title: string | null;
  };
}

/**
 * Reshape Supabase's flat `work_sessions` + nested `profile` rows into the
 * consumed `{ session, profile }` shape, dropping rows whose profile join
 * didn't resolve (defensive; the FK should guarantee one, but a null would
 * crash consumers).
 */
function reshapeTeamRows(data: unknown[] | null): TeammateToday[] {
  return (data ?? []).flatMap((row) => {
    const { profile, ...session } = row as WorkSessionRow & {
      profile: TeammateToday["profile"] | null;
    };
    return profile ? [{ session: session as WorkSessionRow, profile }] : [];
  });
}

export async function getTeamToday(): Promise<TeammateToday[]> {
  const workDate = await getCurrentWorkDate();
  const { data, error } = await supabase
    .from("work_sessions")
    .select(
      "*, profile:profiles!work_sessions_user_id_fkey(id, full_name, display_name, avatar_url, job_title)",
    )
    .eq("work_date", workDate)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return reshapeTeamRows(data);
}

/**
 * Upper bound on rows returned by a team range query. A team of ~20 across a
 * month is ~600 rows, comfortably under this; the cap is a guard against a
 * runaway range silently pulling the whole table. When a result hits the cap,
 * the caller should assume truncation and narrow the range.
 */
export const TEAM_RANGE_MAX_ROWS = 5000;

/** Raw team work sessions in `[from, to]` (no absence synthesis). */
async function fetchTeamSessions(from: string, to: string): Promise<TeammateToday[]> {
  const { data, error } = await supabase
    .from("work_sessions")
    .select(
      "*, profile:profiles!work_sessions_user_id_fkey(id, full_name, display_name, avatar_url, job_title)",
    )
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: false })
    .order("started_at", { ascending: true })
    .limit(TEAM_RANGE_MAX_ROWS);
  if (error) throw error;
  return reshapeTeamRows(data);
}

/** Full-day company holidays whose date falls within `[from, to]` (`YYYY-MM-DD`). */
export async function getFullDayHolidays(from: string, to: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("holidays")
    .select("holiday_date, is_full_day")
    .gte("holiday_date", from)
    .lte("holiday_date", to);
  if (error) throw error;
  return new Set((data ?? []).filter((h) => h.is_full_day).map((h) => h.holiday_date));
}

/** Newest day first; within a day, alphabetical by teammate name. */
function compareTeamRows(a: TeamAttendanceRow, b: TeamAttendanceRow): number {
  if (a.session.work_date !== b.session.work_date) {
    return a.session.work_date < b.session.work_date ? 1 : -1;
  }
  const an = a.profile.display_name ?? a.profile.full_name ?? "";
  const bn = b.profile.display_name ?? b.profile.full_name ?? "";
  return an.localeCompare(bn);
}

/**
 * All team attendance whose `work_date` falls within `[from, to]` (inclusive,
 * `YYYY-MM-DD`), newest day first, with roster-based absences synthesized in.
 *
 * `work_sessions` only has a row once someone clocks in, so this composes the
 * real sessions with synthesized "Absent" rows for active, non-part-time
 * employees who were expected to work (a company working day, on/after their
 * hire date, before today) but have no session. Synthetic rows carry
 * `synthetic: true`. See {@link synthesizeAbsences} for the exact rules and
 * their known limitations (no leave source, no `end_date` gating).
 */
export async function getTeamAttendanceRange(
  from: string,
  to: string,
): Promise<TeamAttendanceRow[]> {
  const [sessions, settings, roster, holidays, today] = await Promise.all([
    fetchTeamSessions(from, to),
    getCompanySettings(),
    fetchHrEmployees(),
    getFullDayHolidays(from, to),
    getCurrentWorkDate(),
  ]);

  const absences = synthesizeAbsences({
    sessions,
    roster,
    from,
    to,
    today,
    weekendDays: settings.weekend_days,
    holidays,
  });

  return [...sessions, ...absences].sort(compareTeamRows);
}

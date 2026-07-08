import { supabase } from "@/integrations/supabase/client";
import type { CompanySettings, TodaySession, WorkSessionBreakRow, WorkSessionRow } from "./types";

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
  return (data ?? []) as unknown as TeammateToday[];
}

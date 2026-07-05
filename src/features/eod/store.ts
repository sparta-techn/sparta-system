/**
 * End-of-Day Report — store facade.
 *
 * Drafts stay in `localStorage`; the **submission** + history are persisted to
 * Supabase via `dailyReportRepository` (`daily_reports`). The public API is
 * unchanged — synchronous getters read in-memory caches hydrated from / written
 * through to Supabase, so no component code had to change.
 */

import { useCallback, useEffect, useReducer, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { currentUserId, localWorkDate, resolveWorkDate } from "@/features/daily-sync";
import { dailyReportRepository } from "@/repositories/reports";
import type { DailyReportInsert, DailyReportRow } from "@/services/reports";

import {
  EMPTY_EOD_DRAFT,
  EMPTY_TOMORROW,
  type EodDraft,
  type EodSubmission,
  type TomorrowPlan,
  type WorkSessionSummary,
} from "./types";

const DRAFT_PREFIX = "sf:eod:draft:";
export const EOD_EDIT_WINDOW_MINUTES = 30;

function todayKey(): string {
  return localWorkDate();
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: Listener) {
  listeners.add(l);
  ensureHydrated();
  return () => listeners.delete(l);
}

// ─── Supabase-backed caches ────────────────────────────────────────────────

let todayJson: string | null = null;
let historyJson = "[]";
let hydrationStarted = false;

function setToday(s: EodSubmission | null) {
  todayJson = s ? JSON.stringify(s) : null;
  emit();
}
function setHistory(list: EodSubmission[]) {
  historyJson = JSON.stringify(list);
  emit();
}

function mapRowToSubmission(row: DailyReportRow): EodSubmission {
  return {
    id: row.id,
    submittedAt: row.submitted_at ?? row.created_at,
    workDate: row.work_date,
    summary: row.summary ?? "",
    completed: row.completed ?? [],
    inProgress: row.in_progress ?? [],
    openDependencies: row.open_dependencies ?? [],
    needFromOthers: row.need_from_others ?? [],
    tomorrow: (row.tomorrow_plan as TomorrowPlan) ?? EMPTY_TOMORROW,
    reflection: row.reflection ?? {},
    sessionSummary: row.session_summary as unknown as WorkSessionSummary,
  };
}

function mapDraftToInsert(
  draft: EodDraft,
  sessionSummary: WorkSessionSummary,
  userId: string,
  workDate: string,
): DailyReportInsert {
  return {
    user_id: userId,
    work_date: workDate,
    summary: draft.summary,
    completed: draft.completed,
    in_progress: draft.inProgress,
    open_dependencies: draft.openDependencies,
    need_from_others: draft.needFromOthers,
    tomorrow_plan: draft.tomorrow,
    reflection: draft.reflection,
    session_summary: sessionSummary as unknown as Record<string, unknown>,
  };
}

async function hydrate() {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const workDate = await resolveWorkDate();
    const [today, history] = await Promise.all([
      dailyReportRepository.getByDate(userId, workDate),
      dailyReportRepository.listByUser(userId),
    ]);
    setToday(today ? mapRowToSubmission(today) : null);
    setHistory(history.map(mapRowToSubmission));
  } catch {
    /* leave caches as-is */
  }
}

function ensureHydrated() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void hydrate();
}

async function persist(draft: EodDraft, sessionSummary: WorkSessionSummary): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) {
      toast.error("You must be signed in to submit an end-of-day report.");
      return;
    }
    const workDate = await resolveWorkDate();
    await dailyReportRepository.submit(mapDraftToInsert(draft, sessionSummary, userId, workDate));
    await hydrate(); // reconcile today + history from the server
  } catch {
    toast.error("Couldn't save your end-of-day report. Please try again.");
  }
}

// ─── Draft (localStorage) ───────────────────────────────────────────────────

export function getEodDraft(workDate = todayKey()): EodDraft {
  if (typeof window === "undefined") return EMPTY_EOD_DRAFT;
  return (
    safeParse<EodDraft>(window.localStorage.getItem(DRAFT_PREFIX + workDate)) ?? EMPTY_EOD_DRAFT
  );
}

export function setEodDraft(draft: EodDraft, workDate = todayKey()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_PREFIX + workDate, JSON.stringify(draft));
}

export function clearEodDraft(workDate = todayKey()) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_PREFIX + workDate);
}

// ─── Submission (Supabase) ──────────────────────────────────────────────────

export function getEodSubmission(): EodSubmission | null {
  ensureHydrated();
  return safeParse<EodSubmission>(todayJson);
}

export function listEodSubmissions(): EodSubmission[] {
  ensureHydrated();
  return safeParse<EodSubmission[]>(historyJson) ?? [];
}

export function submitEod(
  draft: EodDraft,
  sessionSummary: WorkSessionSummary,
  workDate = todayKey(),
): EodSubmission {
  const submission: EodSubmission = {
    ...draft,
    id: `eod_${Date.now()}`,
    submittedAt: new Date().toISOString(),
    workDate,
    sessionSummary,
  };
  setToday(submission); // optimistic
  clearEodDraft(workDate);
  void persist(draft, sessionSummary);
  return submission;
}

export function updateEodSubmission(patch: EodDraft, workDate = todayKey()): EodSubmission | null {
  const existing = getEodSubmission();
  if (!existing) return null;
  const next: EodSubmission = { ...existing, ...patch };
  setToday(next); // optimistic
  void persist(patch, existing.sessionSummary);
  return next;
}

export function canEditEod(s: EodSubmission | null): boolean {
  if (!s) return false;
  return Date.now() - new Date(s.submittedAt).getTime() <= EOD_EDIT_WINDOW_MINUTES * 60_000;
}

// ─── Completion percentage (for widget) ───────────────────────────────────

const SECTIONS = [
  "summary",
  "completed",
  "inProgress",
  "openDeps",
  "needFromOthers",
  "tomorrow",
  "reflection",
] as const;

export function eodCompletionPct(d: EodDraft): number {
  const filled = [
    !!d.summary.trim(),
    d.completed.length > 0,
    d.inProgress.length > 0,
    d.openDependencies.length > 0,
    d.needFromOthers.length > 0,
    d.tomorrow.priorities.length + d.tomorrow.tasks.length + d.tomorrow.meetings.length > 0,
    !!(d.reflection.wentWell || d.reflection.slowedDown || d.reflection.forManager),
  ].filter(Boolean).length;
  return Math.round((filled / SECTIONS.length) * 100);
}

// ─── React bindings ───────────────────────────────────────────────────────

export function useTodayEod(): EodSubmission | null {
  const snap = useSyncExternalStore(
    subscribe,
    () => todayJson,
    () => null,
  );
  return safeParse<EodSubmission>(snap);
}

export function useEodHistory(): EodSubmission[] {
  const snap = useSyncExternalStore(
    subscribe,
    () => historyJson,
    () => "[]",
  );
  return safeParse<EodSubmission[]>(snap) ?? [];
}

export function useMinuteTick(): number {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const tick = useCallback(() => force(), []);
  useEffect(() => {
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [tick]);
  return Date.now();
}

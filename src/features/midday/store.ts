/**
 * Midday Status — store facade.
 *
 * Drafts stay in `localStorage`; the **submission** is persisted to Supabase via
 * `statusUpdateRepository` (`daily_status_updates`, `kind='midday'`). The public
 * API is unchanged — synchronous getters read an in-memory cache hydrated from /
 * written through to Supabase, so no component code had to change.
 */

import { useCallback, useEffect, useReducer, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { currentUserId, localWorkDate, resolveWorkDate } from "@/features/daily-sync";
import { statusUpdateRepository, type StatusUpdatePayload } from "@/repositories/reports";
import type { StatusUpdateRow } from "@/services/reports";
import type { BlockerItem } from "@/features/checkin/types";

import {
  EMPTY_MIDDAY_DRAFT,
  type BlockerLink,
  type HelpRequest,
  type MiddayDraft,
  type MiddaySubmission,
} from "./types";

const DRAFT_PREFIX = "sf:midday:draft:";
export const MIDDAY_EDIT_WINDOW_MINUTES = 30;
/** Default reminder time (24h). */
export const MIDDAY_REMINDER_HOUR = 14;

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

// ─── Supabase-backed submission cache ──────────────────────────────────────

let submissionJson: string | null = null;
let hydrationStarted = false;

function setSubmission(s: MiddaySubmission | null) {
  submissionJson = s ? JSON.stringify(s) : null;
  emit();
}

function mapRowToSubmission(row: StatusUpdateRow): MiddaySubmission {
  return {
    id: row.id,
    submittedAt: row.submitted_at ?? row.created_at,
    workDate: row.work_date,
    progress: row.progress ?? 50,
    taskProgress: row.task_progress ?? [],
    currentFocus: row.current_focus ?? "",
    // blocker links are stored in the `blockers` jsonb column for midday rows.
    blockerLinks: (row.blockers as unknown as BlockerLink[]) ?? [],
    // free-text inline blocker is parked in `mood_note` (midday has no mood).
    newBlockerNotes: row.mood_note ?? "",
    help: (row.help_request as HelpRequest) ?? { enabled: false },
    outlook: row.outlook ?? null,
  };
}

function mapDraftToPayload(
  draft: MiddayDraft,
  userId: string,
  workDate: string,
): StatusUpdatePayload {
  return {
    user_id: userId,
    work_date: workDate,
    progress: draft.progress,
    task_progress: draft.taskProgress,
    current_focus: draft.currentFocus,
    outlook: draft.outlook,
    help_request: draft.help,
    blockers: draft.blockerLinks as unknown as BlockerItem[],
    mood_note: draft.newBlockerNotes,
  };
}

async function hydrate() {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const workDate = await resolveWorkDate();
    const row = await statusUpdateRepository.getMidday(userId, workDate);
    setSubmission(row ? mapRowToSubmission(row) : null);
  } catch {
    /* leave cache as-is */
  }
}

function ensureHydrated() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void hydrate();
}

async function persist(draft: MiddayDraft): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) {
      toast.error("You must be signed in to submit a midday status.");
      return;
    }
    const workDate = await resolveWorkDate();
    const row = await statusUpdateRepository.submitMidday(
      mapDraftToPayload(draft, userId, workDate),
    );
    setSubmission(mapRowToSubmission(row));
  } catch {
    toast.error("Couldn't save your midday status. Please try again.");
  }
}

// ─── public API (unchanged signatures) ─────────────────────────────────────

export function getMiddayDraft(workDate = todayKey()): MiddayDraft {
  if (typeof window === "undefined") return EMPTY_MIDDAY_DRAFT;
  return (
    safeParse<MiddayDraft>(window.localStorage.getItem(DRAFT_PREFIX + workDate)) ??
    EMPTY_MIDDAY_DRAFT
  );
}

export function setMiddayDraft(draft: MiddayDraft, workDate = todayKey()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_PREFIX + workDate, JSON.stringify(draft));
}

export function clearMiddayDraft(workDate = todayKey()) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_PREFIX + workDate);
}

export function getMiddaySubmission(): MiddaySubmission | null {
  ensureHydrated();
  return safeParse<MiddaySubmission>(submissionJson);
}

export function submitMidday(draft: MiddayDraft, workDate = todayKey()): MiddaySubmission {
  const submission: MiddaySubmission = {
    ...draft,
    id: `mid_${Date.now()}`,
    submittedAt: new Date().toISOString(),
    workDate,
  };
  setSubmission(submission); // optimistic
  clearMiddayDraft(workDate);
  void persist(draft);
  return submission;
}

export function updateMiddaySubmission(
  patch: MiddayDraft,
  workDate = todayKey(),
): MiddaySubmission | null {
  const existing = getMiddaySubmission();
  if (!existing) return null;
  const next: MiddaySubmission = { ...existing, ...patch };
  setSubmission(next); // optimistic
  void persist(patch);
  return next;
}

export function canEditMidday(s: MiddaySubmission | null): boolean {
  if (!s) return false;
  return Date.now() - new Date(s.submittedAt).getTime() <= MIDDAY_EDIT_WINDOW_MINUTES * 60_000;
}

export function useTodayMidday(): MiddaySubmission | null {
  const snap = useSyncExternalStore(
    subscribe,
    () => submissionJson,
    () => null,
  );
  return safeParse<MiddaySubmission>(snap);
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

/** True when the reminder hour has passed and no submission exists yet. */
export function shouldRemind(now = new Date(), hour = MIDDAY_REMINDER_HOUR): boolean {
  if (now.getHours() < hour) return false;
  if (now.getHours() >= 18) return false;
  return getMiddaySubmission() === null;
}

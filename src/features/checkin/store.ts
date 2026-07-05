/**
 * Morning Check-in — store facade.
 *
 * Drafts stay in `localStorage` (local working state). The **submission** is
 * persisted to Supabase via `statusUpdateRepository` (`daily_status_updates`,
 * `kind='morning_checkin'`). The public API is unchanged — the synchronous
 * getters read an in-memory cache that is hydrated from, and written through to,
 * Supabase, so no component code had to change.
 */

import { useCallback, useEffect, useReducer, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { currentUserId, localWorkDate, resolveWorkDate } from "@/features/daily-sync";
import type { HelpRequest as ServiceHelpRequest } from "@/features/checkin/types";
import { statusUpdateRepository, type StatusUpdatePayload } from "@/repositories/reports";
import type { StatusUpdateRow } from "@/services/reports";

import { EMPTY_DRAFT, type CheckInDraft, type CheckInSubmission } from "./types";

const DRAFT_PREFIX = "sf:checkin:draft:";
/** Editable window after submission, in minutes. */
export const EDIT_WINDOW_MINUTES = 30;

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

// ─── pub/sub for cross-component reactivity ────────────────────────────────

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

/** JSON snapshot of today's submission (or `null`). Kept stable for `useSyncExternalStore`. */
let submissionJson: string | null = null;
let hydrationStarted = false;

function setSubmission(s: CheckInSubmission | null) {
  submissionJson = s ? JSON.stringify(s) : null;
  emit();
}

function mapRowToSubmission(row: StatusUpdateRow): CheckInSubmission {
  return {
    id: row.id,
    submittedAt: row.submitted_at ?? row.created_at,
    workDate: row.work_date,
    mood: row.mood ?? null,
    moodNote: row.mood_note ?? "",
    mainGoal: row.main_goal ?? "",
    priorities: row.priorities ?? [],
    // No planned-tasks column on daily_status_updates; the picker is mock-backed.
    taskIds: [],
    blockers: row.blockers ?? [],
    help: (row.help_request as ServiceHelpRequest) ?? { enabled: false },
  };
}

function mapDraftToPayload(
  draft: CheckInDraft,
  userId: string,
  workDate: string,
): StatusUpdatePayload {
  return {
    user_id: userId,
    work_date: workDate,
    mood: draft.mood,
    mood_note: draft.moodNote,
    main_goal: draft.mainGoal,
    priorities: draft.priorities,
    blockers: draft.blockers,
    help_request: draft.help,
  };
}

async function hydrate() {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const workDate = await resolveWorkDate();
    const row = await statusUpdateRepository.getCheckin(userId, workDate);
    setSubmission(row ? mapRowToSubmission(row) : null);
  } catch {
    // Leave cache as-is; the UI simply shows "not submitted".
  }
}

function ensureHydrated() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void hydrate();
}

async function persist(draft: CheckInDraft): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) {
      toast.error("You must be signed in to submit a check-in.");
      return;
    }
    const workDate = await resolveWorkDate();
    const row = await statusUpdateRepository.submitCheckin(
      mapDraftToPayload(draft, userId, workDate),
    );
    setSubmission(mapRowToSubmission(row));
  } catch {
    toast.error("Couldn't save your check-in. Please try again.");
  }
}

// ─── public API (unchanged signatures) ─────────────────────────────────────

export function getDraft(workDate = todayKey()): CheckInDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  return (
    safeParse<CheckInDraft>(window.localStorage.getItem(DRAFT_PREFIX + workDate)) ?? EMPTY_DRAFT
  );
}

export function setDraft(draft: CheckInDraft, workDate = todayKey()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_PREFIX + workDate, JSON.stringify(draft));
}

export function clearDraft(workDate = todayKey()): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_PREFIX + workDate);
}

export function getSubmission(): CheckInSubmission | null {
  ensureHydrated();
  return safeParse<CheckInSubmission>(submissionJson);
}

export function submitCheckIn(draft: CheckInDraft, workDate = todayKey()): CheckInSubmission {
  const submission: CheckInSubmission = {
    ...draft,
    id: `ci_${Date.now()}`,
    submittedAt: new Date().toISOString(),
    workDate,
  };
  setSubmission(submission); // optimistic
  clearDraft(workDate);
  void persist(draft); // write through to Supabase + reconcile
  return submission;
}

export function updateSubmission(
  patch: CheckInDraft,
  workDate = todayKey(),
): CheckInSubmission | null {
  const existing = getSubmission();
  if (!existing) return null;
  const next: CheckInSubmission = { ...existing, ...patch };
  setSubmission(next); // optimistic
  void persist(patch); // upsert (idempotent on user+date+kind)
  return next;
}

export function canEditSubmission(s: CheckInSubmission | null): boolean {
  if (!s) return false;
  const ageMs = Date.now() - new Date(s.submittedAt).getTime();
  return ageMs <= EDIT_WINDOW_MINUTES * 60_000;
}

export function getTodayWorkDate(): string {
  return todayKey();
}

// ─── React hooks ────────────────────────────────────────────────────────────

export function useTodaySubmission(): CheckInSubmission | null {
  const snap = useSyncExternalStore(
    subscribe,
    () => submissionJson,
    () => null,
  );
  return safeParse<CheckInSubmission>(snap);
}

/** Re-renders every minute so the "X min ago" / edit window expiry stays live. */
export function useMinuteTick(): number {
  const [, force] = useTick();
  useEffect(() => {
    const id = window.setInterval(force, 60_000);
    return () => window.clearInterval(id);
  }, [force]);
  return Date.now();
}

function useTick(): [number, () => void] {
  const [n, dispatch] = useReducer((x: number) => x + 1, 0);
  return [n, useCallback(() => dispatch(), [])];
}

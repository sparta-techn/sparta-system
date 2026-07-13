/**
 * End-of-Day Report — domain types.
 *
 * UI scaffolding only. All persistence flows through `store.ts` so a future
 * backend (Supabase RPC: `submit_eod_report`, `update_eod_report`,
 * `get_session_eod`) can drop in without touching components.
 *
 * One report per Work Session. After submission the Work Session becomes
 * ready for checkout.
 */

import type { PriorityLevel } from "@/features/checkin/types";
import type { TaskProgressEntry, TaskProgressState } from "@/features/midday/types";

export const SUMMARY_MAX_LENGTH = 500;

// ─── In-progress work ─────────────────────────────────────────────────────

export interface InProgressItem {
  id: string;
  title: string;
  priority: PriorityLevel;
  /** Free-form ETA: "Tomorrow EOD", "Mid next week", "Today + 1h". */
  eta: string;
  notes?: string;
}

// ─── Open dependencies (snapshot at submit time) ──────────────────────────

export interface OpenDependencyEntry {
  dependencyId: string;
  titleSnapshot: string;
  note?: string;
  /** Employee marked this dependency as resolved while filling the EOD. */
  resolvedNow?: boolean;
}

// ─── Need from others tomorrow ────────────────────────────────────────────

/**
 * Legacy fallback labels. The wizard's department picker now reads the live
 * `departments` table (via `hrQueries.departments()`); this constant is kept
 * only for reference/back-compat with older persisted reports.
 */
export const NEED_DEPARTMENTS = [
  "Backend",
  "Flutter",
  "QA",
  "DevOps",
  "UI/UX",
  "Product",
  "Manager",
  "Client",
] as const;
export type NeedDepartment = (typeof NEED_DEPARTMENTS)[number];

export interface NeedFromOthersItem {
  id: string;
  /** A live department name (see `hrQueries.departments()`). */
  department: string;
  description: string;
  priority: PriorityLevel;
  dueDate?: string;
  relatedDependencyId?: string;
}

// ─── Tomorrow plan ────────────────────────────────────────────────────────

export interface TomorrowPlan {
  priorities: string[];
  tasks: string[];
  meetings: string[];
  expectedBlockers: string[];
}

export const EMPTY_TOMORROW: TomorrowPlan = {
  priorities: [],
  tasks: [],
  meetings: [],
  expectedBlockers: [],
};

// ─── Daily reflection (all optional) ──────────────────────────────────────

export interface DailyReflection {
  wentWell?: string;
  slowedDown?: string;
  forManager?: string;
}

// ─── Work session auto summary ────────────────────────────────────────────

export interface WorkSessionSummary {
  checkIn?: string; // HH:MM
  checkOut?: string; // HH:MM (estimated "now" at submission)
  workedMinutes: number;
  breakMinutes: number;
  morningCheckInDone: boolean;
  middayStatusDone: boolean;
  dependenciesCreated: number;
  dependenciesResolved: number;
}

// ─── Draft + submission ───────────────────────────────────────────────────

export interface EodDraft {
  summary: string;
  completed: TaskProgressEntry[];
  inProgress: InProgressItem[];
  openDependencies: OpenDependencyEntry[];
  needFromOthers: NeedFromOthersItem[];
  tomorrow: TomorrowPlan;
  reflection: DailyReflection;
}

export interface EodSubmission extends EodDraft {
  id: string;
  submittedAt: string;
  workDate: string;
  sessionSummary: WorkSessionSummary;
}

export const EMPTY_EOD_DRAFT: EodDraft = {
  summary: "",
  completed: [],
  inProgress: [],
  openDependencies: [],
  needFromOthers: [],
  tomorrow: EMPTY_TOMORROW,
  reflection: {},
};

// ─── Manager roll-up ──────────────────────────────────────────────────────

/** One row in the manager/HR EOD roll-up (see `useTeamEodOverview`). */
export interface TeamEodEntry {
  employeeId: string;
  name: string;
  initials: string;
  department: string;
  role: string;
  submitted: boolean;
  /**
   * Genuinely missing their EOD right now (no submitted report AND their working
   * day is over per employment type — see `countsAsMissingEod`). Part-timers who
   * haven't finished a session today are not counted.
   */
  missingEod: boolean;
  submittedAt?: string;
  completionPct?: number;
  completedCount?: number;
  inProgressCount?: number;
  openDepsCount?: number;
  topBlocker?: string;
  tomorrowRisk?: string;
  helpRequest?: string;
}

// ─── Display helpers ──────────────────────────────────────────────────────

export const TASK_STATE_ICON: Record<TaskProgressState, string> = {
  completed: "✓",
  partial: "◐",
  not_started: "○",
};

/**
 * Midday Status Report — domain types.
 *
 * UI-only scaffolding. All persistence flows through `store.ts` so a future
 * backend (Supabase RPC) can be swapped in without touching components.
 */

import type { PriorityLevel } from "@/features/checkin/types";

export type TaskProgressState = "completed" | "partial" | "not_started";

export const TASK_PROGRESS_META: Record<
  TaskProgressState,
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  completed: { label: "Completed", tone: "success" },
  partial: { label: "Partially done", tone: "warning" },
  not_started: { label: "Not started", tone: "neutral" },
};

export interface TaskProgressEntry {
  taskId: string;
  /** Snapshot of the task title at submission time so historical reports stay readable. */
  title: string;
  project?: string;
  state: TaskProgressState;
  note?: string;
}

export type EndOfDayOutlook = "on_track" | "need_more_time" | "blocked" | "need_manager_help";

export const OUTLOOK_META: Record<
  EndOfDayOutlook,
  {
    label: string;
    description: string;
    tone: "success" | "warning" | "danger" | "info";
    emoji: string;
  }
> = {
  on_track: {
    label: "Likely to finish today's plan",
    description: "Things are moving — no manager action needed.",
    tone: "success",
    emoji: "🟢",
  },
  need_more_time: {
    label: "Need more time",
    description: "Plan will slip a bit. Nothing critical.",
    tone: "warning",
    emoji: "🟡",
  },
  blocked: {
    label: "Blocked",
    description: "A dependency is preventing progress.",
    tone: "danger",
    emoji: "🔴",
  },
  need_manager_help: {
    label: "Need manager assistance",
    description: "Decision or unblocker required from leadership.",
    tone: "danger",
    emoji: "🆘",
  },
};

/** Reference to an existing dependency (from the Dependencies module). */
export interface BlockerLink {
  dependencyId: string;
  /** Snapshot in case the dependency is later renamed or closed. */
  titleSnapshot: string;
  resolved?: boolean;
}

export interface HelpRequest {
  enabled: boolean;
  departmentId?: string;
  employeeId?: string;
  description?: string;
  priority?: PriorityLevel;
}

export interface MiddayDraft {
  progress: number; // 0..100, multiples of 10
  taskProgress: TaskProgressEntry[];
  currentFocus: string;
  blockerLinks: BlockerLink[];
  /** Free-text fall-back when a brand-new blocker is captured inline. */
  newBlockerNotes: string;
  help: HelpRequest;
  outlook: EndOfDayOutlook | null;
}

export interface MiddaySubmission extends MiddayDraft {
  id: string;
  submittedAt: string;
  workDate: string;
}

export const EMPTY_MIDDAY_DRAFT: MiddayDraft = {
  progress: 50,
  taskProgress: [],
  currentFocus: "",
  blockerLinks: [],
  newBlockerNotes: "",
  help: { enabled: false },
  outlook: null,
};

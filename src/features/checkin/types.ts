/**
 * Morning Check-in — domain types.
 *
 * UI-only for now. All persistence goes through a single `store.ts` facade so
 * a future backend (Supabase RPC) can be swapped in without touching UI code.
 */

export type Mood = "excellent" | "good" | "okay" | "stressed" | "difficult";

export const MOOD_OPTIONS: {
  value: Mood;
  emoji: string;
  label: string;
  tone: "success" | "primary" | "neutral" | "warning" | "danger";
}[] = [
  { value: "excellent", emoji: "😁", label: "Excellent", tone: "success" },
  { value: "good", emoji: "😊", label: "Good", tone: "primary" },
  { value: "okay", emoji: "😐", label: "Okay", tone: "neutral" },
  { value: "stressed", emoji: "😕", label: "Stressed", tone: "warning" },
  { value: "difficult", emoji: "😞", label: "Difficult day", tone: "danger" },
];

export type PriorityLevel = "low" | "medium" | "high" | "urgent";
export type EffortEstimate = "xs" | "s" | "m" | "l" | "xl";

export const EFFORT_META: Record<EffortEstimate, { label: string; hours: string }> = {
  xs: { label: "XS", hours: "< 30m" },
  s: { label: "S", hours: "~1h" },
  m: { label: "M", hours: "~2-3h" },
  l: { label: "L", hours: "~half day" },
  xl: { label: "XL", hours: "~full day" },
};

export interface PriorityItem {
  id: string;
  title: string;
  level: PriorityLevel;
  effort: EffortEstimate;
}

export interface PlannedTask {
  id: string;
  title: string;
  project: string;
  source: "clickup" | "manual";
  priority: PriorityLevel;
  deadline?: string;
}

export type BlockerKind =
  | "backend_api"
  | "ui_design"
  | "client_feedback"
  | "qa"
  | "devops"
  | "product_decision"
  | "custom";

export const BLOCKER_PRESETS: { kind: Exclude<BlockerKind, "custom">; label: string }[] = [
  { kind: "backend_api", label: "Waiting for Backend API" },
  { kind: "ui_design", label: "Waiting for UI Design" },
  { kind: "client_feedback", label: "Waiting for Client Feedback" },
  { kind: "qa", label: "Waiting for QA" },
  { kind: "devops", label: "Waiting for DevOps" },
  { kind: "product_decision", label: "Waiting for Product Decision" },
];

export interface BlockerItem {
  id: string;
  kind: BlockerKind;
  label: string;
  note?: string;
}

export interface HelpRequest {
  enabled: boolean;
  departmentId?: string;
  employeeId?: string;
  description?: string;
  priority?: PriorityLevel;
  desiredDate?: string;
}

export interface CheckInDraft {
  mood: Mood | null;
  moodNote: string;
  mainGoal: string;
  priorities: PriorityItem[];
  taskIds: string[];
  blockers: BlockerItem[];
  help: HelpRequest;
}

export interface CheckInSubmission extends CheckInDraft {
  id: string;
  submittedAt: string; // ISO
  workDate: string; // YYYY-MM-DD
}

export const EMPTY_DRAFT: CheckInDraft = {
  mood: null,
  moodNote: "",
  mainGoal: "",
  priorities: [],
  taskIds: [],
  blockers: [],
  help: { enabled: false },
};

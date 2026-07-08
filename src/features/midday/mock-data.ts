/**
 * Midday — mock data for manager overview and reminders.
 * Reuses Morning Check-in directory + Dependencies people where possible.
 */

import type { MiddaySubmission, TaskProgressState } from "./types";

export const MOCK_TASK_PROGRESS_SEED: { taskId: string; state: TaskProgressState }[] = [
  { taskId: "T-1042", state: "partial" },
  { taskId: "T-1051", state: "not_started" },
  { taskId: "T-1038", state: "completed" },
];

/** Used when no real submission exists, for design previews. */
export const SAMPLE_MIDDAY_SUBMISSION: MiddaySubmission = {
  id: "mid_sample",
  submittedAt: new Date().toISOString(),
  workDate: new Date().toISOString().slice(0, 10),
  progress: 60,
  taskProgress: [],
  currentFocus: "Wiring auth middleware into checkout flow",
  blockerLinks: [],
  newBlockerNotes: "",
  help: { enabled: false },
  outlook: "on_track",
};

/**
 * Time Tracking — lightweight extension over Tasks.
 * Pure mock layer: a TimeLog belongs to a Task and a User.
 */

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  startTime: string; // ISO
  endTime: string | null; // null = active timer
  /** Calculated minutes. Null while active. */
  durationMinutes: number | null;
  description: string | null;
  source: "timer" | "manual";
  createdAt: string;
}

export interface ManualEntryInput {
  taskId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  hours: number; // decimal hours, eg 1.5
  description?: string;
}

export type TimeRange = "today" | "week" | "month";

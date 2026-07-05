/**
 * Reusable context sources — one per SpartaFlow module.
 *
 * Every source reads **only** through the service layer (`@/services/*`). None of
 * them import a UI component or a feature store: the AI gathers context from the
 * same service boundary the app uses, never from the view layer.
 */

import type { ContextSource, ContextSourceKey } from "../../types";
import { profileSource } from "./profile.source";
import { attendanceSource } from "./attendance.source";
import { dailyReportsSource } from "./daily-reports.source";
import { projectsSource } from "./projects.source";
import { tasksSource } from "./tasks.source";
import { sprintsSource } from "./sprints.source";
import { timeTrackingSource } from "./time-tracking.source";
import { commentsSource } from "./comments.source";
import { dependenciesSource } from "./dependencies.source";
import { notificationsSource } from "./notifications.source";

export {
  profileSource,
  attendanceSource,
  dailyReportsSource,
  projectsSource,
  tasksSource,
  sprintsSource,
  timeTrackingSource,
  commentsSource,
  dependenciesSource,
  notificationsSource,
};

/** Every source, keyed by its stable {@link ContextSourceKey}. */
export const CONTEXT_SOURCES: Record<ContextSourceKey, ContextSource> = {
  profile: profileSource,
  attendance: attendanceSource,
  daily_reports: dailyReportsSource,
  projects: projectsSource,
  tasks: tasksSource,
  sprints: sprintsSource,
  time_tracking: timeTrackingSource,
  comments: commentsSource,
  dependencies: dependenciesSource,
  notifications: notificationsSource,
};

/** Resolve a source by key. */
export function getSource(key: ContextSourceKey): ContextSource {
  return CONTEXT_SOURCES[key];
}

/** Resolve many sources by key, preserving order. */
export function getSources(keys: ContextSourceKey[]): ContextSource[] {
  return keys.map(getSource);
}

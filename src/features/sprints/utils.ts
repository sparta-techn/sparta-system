import type { Task } from "@/features/tasks/types";
import type { Sprint } from "./types";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sFmt = s.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const eFmt = e.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${sFmt} → ${eFmt}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 86400000));
}

export function daysRemaining(sprint: Sprint): number {
  return Math.max(0, Math.round((+new Date(sprint.endDate) - Date.now()) / 86400000));
}

export interface SprintStats {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  todo: number;
  review: number;
  points: number;
  pointsCompleted: number;
  progress: number; // 0-100
}

export function sprintStats(tasks: Task[]): SprintStats {
  const stats: SprintStats = {
    total: tasks.length,
    completed: 0,
    inProgress: 0,
    blocked: 0,
    todo: 0,
    review: 0,
    points: 0,
    pointsCompleted: 0,
    progress: 0,
  };
  for (const t of tasks) {
    stats.points += t.storyPoints ?? 0;
    if (t.status === "done") {
      stats.completed += 1;
      stats.pointsCompleted += t.storyPoints ?? 0;
    } else if (t.status === "in_progress") stats.inProgress += 1;
    else if (t.status === "blocked") stats.blocked += 1;
    else if (t.status === "review" || t.status === "qa") stats.review += 1;
    else if (t.status === "todo" || t.status === "backlog") stats.todo += 1;
  }
  stats.progress = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);
  return stats;
}

export function buildBurndown(sprint: Sprint, stats: SprintStats): Array<{ day: number; ideal: number; actual: number }> {
  const totalDays = daysBetween(sprint.startDate, sprint.endDate);
  const total = stats.points || stats.total || 10;
  const elapsed = Math.min(
    totalDays,
    Math.max(0, Math.round((Date.now() - +new Date(sprint.startDate)) / 86400000)),
  );
  const points: Array<{ day: number; ideal: number; actual: number }> = [];
  for (let d = 0; d <= totalDays; d++) {
    const ideal = total - (total * d) / totalDays;
    // mock actual: lags ideal slightly with jitter, frozen after today
    let actual = total;
    if (d <= elapsed) {
      const ratio = d / Math.max(1, totalDays);
      actual = total - total * ratio * (0.75 + 0.25 * Math.sin(d));
      actual = Math.max(stats.pointsCompleted, Math.min(total, actual));
    } else {
      actual = NaN;
    }
    points.push({ day: d, ideal: Math.max(0, ideal), actual });
  }
  return points;
}

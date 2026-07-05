/**
 * Project Analytics — pure read-only selectors over existing stores.
 *
 * No writes, no business logic. Aggregates Tasks, Sprints, Time Logs,
 * Comments and Files into UI-friendly shapes.
 */
import { listTasks, activityFor, commentsFor } from "@/features/tasks/store";
import { listSprints, tasksInSprint } from "@/features/sprints/store";
import { getAllLogs } from "@/features/time-tracking/store";
import { commStore } from "@/features/task-communication/store";
import { employees } from "@/features/hr/mock-data";
import type { Task, TaskStatus } from "@/features/tasks/types";
import type { Sprint } from "@/features/sprints/types";
import type { TimeLog } from "@/features/time-tracking/types";

export interface AnalyticsFilters {
  projectId: string;
  sprintId?: string | "all";
  userId?: string | "all";
  /** days back from today; default 30 */
  rangeDays?: number;
}

export interface ProjectTasksSnapshot {
  tasks: Task[];
  total: number;
  completed: number;
  open: number;
  overdue: number;
  blocked: number;
  inProgress: number;
  review: number;
  completionPct: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d = new Date()): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

export function rangeStart(days: number): Date {
  return new Date(startOfDay().getTime() - (days - 1) * DAY);
}

export function dayKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function shortDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function employeeName(id: string): string {
  return employees.find((e) => e.id === id)?.name ?? "Unknown";
}

// ── Core filtering ───────────────────────────────────────────────────────

export function filterProjectTasks(filters: AnalyticsFilters): Task[] {
  let tasks = listTasks().filter((t) => t.projectId === filters.projectId);
  if (filters.sprintId && filters.sprintId !== "all") {
    tasks = tasks.filter((t) => t.sprintId === filters.sprintId);
  }
  if (filters.userId && filters.userId !== "all") {
    tasks = tasks.filter((t) => t.assigneeId === filters.userId);
  }
  return tasks;
}

export function snapshotTasks(tasks: Task[]): ProjectTasksSnapshot {
  const total = tasks.length;
  const now = Date.now();
  const completed = tasks.filter((t) => t.status === "done").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const review = tasks.filter((t) => t.status === "review" || t.status === "qa").length;
  const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length;
  const overdue = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < now && !["done", "cancelled"].includes(t.status),
  ).length;
  const completionPct = total ? Math.round((completed / total) * 100) : 0;
  return { tasks, total, completed, open, overdue, blocked, inProgress, review, completionPct };
}

// ── Time-series ──────────────────────────────────────────────────────────

export function tasksCreatedPerDay(tasks: Task[], days: number) {
  const start = rangeStart(days);
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY);
    buckets.set(dayKey(d), 0);
  }
  for (const t of tasks) {
    const k = dayKey(t.createdAt);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([k, v]) => ({ label: shortDay(new Date(k)), value: v }));
}

export function tasksCompletedPerDay(tasks: Task[], days: number) {
  const start = rangeStart(days);
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY);
    buckets.set(dayKey(d), 0);
  }
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const k = dayKey(t.completedAt);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([k, v]) => ({ label: shortDay(new Date(k)), value: v }));
}

export function cumulativeCompletion(tasks: Task[], days: number) {
  const start = rangeStart(days);
  const series: { label: string; value: number }[] = [];
  let running = 0;
  const completedByDay = new Map<string, number>();
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const k = dayKey(t.completedAt);
    completedByDay.set(k, (completedByDay.get(k) ?? 0) + 1);
  }
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY);
    running += completedByDay.get(dayKey(d)) ?? 0;
    series.push({ label: shortDay(d), value: running });
  }
  return series;
}

// ── Team performance ────────────────────────────────────────────────────

export interface UserStat {
  userId: string;
  name: string;
  total: number;
  done: number;
  open: number;
  overdue: number;
  hours: number;
}

export function tasksPerUser(tasks: Task[], logs: TimeLog[]): UserStat[] {
  const map = new Map<string, UserStat>();
  for (const t of tasks) {
    const id = t.assigneeId ?? "unassigned";
    if (!map.has(id)) {
      map.set(id, { userId: id, name: id === "unassigned" ? "Unassigned" : employeeName(id),
        total: 0, done: 0, open: 0, overdue: 0, hours: 0 });
    }
    const s = map.get(id)!;
    s.total += 1;
    if (t.status === "done") s.done += 1;
    else s.open += 1;
    if (t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "done") s.overdue += 1;
  }
  const taskIds = new Set(tasks.map((t) => t.id));
  for (const l of logs) {
    if (!taskIds.has(l.taskId)) continue;
    const s = map.get(l.userId);
    if (!s) continue;
    s.hours += (l.durationMinutes ?? 0) / 60;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// ── Time analytics ──────────────────────────────────────────────────────

export function projectTimeLogs(projectId: string): TimeLog[] {
  const projectTaskIds = new Set(listTasks().filter((t) => t.projectId === projectId).map((t) => t.id));
  return getAllLogs().filter((l) => projectTaskIds.has(l.taskId) && l.durationMinutes != null);
}

export interface TaskHours { taskId: string; title: string; hours: number; }

export function topTimeConsumingTasks(tasks: Task[], logs: TimeLog[], limit = 6): TaskHours[] {
  const byTask = new Map<string, number>();
  const taskIds = new Set(tasks.map((t) => t.id));
  for (const l of logs) {
    if (!taskIds.has(l.taskId)) continue;
    byTask.set(l.taskId, (byTask.get(l.taskId) ?? 0) + (l.durationMinutes ?? 0));
  }
  return [...byTask.entries()]
    .map(([id, mins]) => ({
      taskId: id,
      title: tasks.find((t) => t.id === id)?.title ?? id,
      hours: mins / 60,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit);
}

// ── Sprints ─────────────────────────────────────────────────────────────

export function sprintsForProject(projectId: string): Sprint[] {
  return listSprints().filter((s) => s.projectId === projectId);
}

export interface SprintProgress {
  sprint: Sprint;
  total: number;
  done: number;
  pct: number;
}

export function sprintProgressList(projectId: string): SprintProgress[] {
  return sprintsForProject(projectId).map((sp) => {
    const ts = tasksInSprint(sp.id);
    const done = ts.filter((t) => t.status === "done").length;
    return { sprint: sp, total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
  });
}

/** Deterministic mock velocity (story points) per sprint. */
export function sprintVelocityMock(projectId: string) {
  return sprintsForProject(projectId).slice(-6).map((sp, i) => ({
    label: sp.name,
    value: 18 + ((i * 7 + sp.name.length) % 16),
  }));
}

/** Deterministic mock burndown for active sprint (or first). */
export function burndownMock(projectId: string) {
  const sprint = sprintsForProject(projectId).find((s) => s.status === "active") ?? sprintsForProject(projectId)[0];
  if (!sprint) return [] as { label: string; value: number; ideal: number }[];
  const totalDays = 10;
  const capacity = sprint.capacity || 40;
  const out: { label: string; value: number; ideal: number }[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const ideal = Math.round(capacity - (capacity * i) / totalDays);
    const noise = Math.sin(i * 1.3 + capacity) * 3;
    const actual = Math.max(0, Math.round(capacity - (capacity * i) / totalDays + noise + (i > totalDays / 2 ? 2 : 0)));
    out.push({ label: `D${i}`, value: actual, ideal });
  }
  return out;
}

// ── Bottlenecks & cycle time (mock) ─────────────────────────────────────

export function statusDistribution(tasks: Task[]): { label: string; value: number }[] {
  const order: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "qa", "done", "blocked", "cancelled"];
  return order.map((s) => ({
    label: s.replace("_", " "),
    value: tasks.filter((t) => t.status === s).length,
  }));
}

export function bottleneckStage(tasks: Task[]): string {
  const inFlight = (["in_progress", "review", "qa", "blocked"] as TaskStatus[]).map((s) => ({
    s, n: tasks.filter((t) => t.status === s).length,
  }));
  inFlight.sort((a, b) => b.n - a.n);
  return inFlight[0]?.n ? inFlight[0].s.replace("_", " ") : "—";
}

/** Mock average cycle time in days, derived deterministically from project task count. */
export function avgCycleTime(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((3 + (tasks.length % 7) + 0.4 * tasks.filter((t) => t.status === "done").length / Math.max(1, tasks.length) * 10) * 10) / 10;
}

// ── Dependencies (mock from blocked status) ─────────────────────────────

export function dependencyInsights(tasks: Task[]) {
  const blocked = tasks.filter((t) => t.status === "blocked");
  const chains = Math.min(blocked.length, 4);
  const mostBlocking = blocked[0]?.title ?? null;
  return { blockedCount: blocked.length, chains, mostBlocking };
}

// ── Unified activity timeline ───────────────────────────────────────────

export interface AnalyticsActivityItem {
  id: string;
  at: string;
  kind: "task" | "comment" | "file" | "sprint";
  summary: string;
  actorId?: string;
  taskId?: string;
}

export function unifiedActivity(projectId: string, limit = 40): AnalyticsActivityItem[] {
  const tasks = listTasks().filter((t) => t.projectId === projectId);
  const taskIds = new Set(tasks.map((t) => t.id));
  const out: AnalyticsActivityItem[] = [];

  for (const t of tasks) {
    for (const a of activityFor(t.id)) {
      out.push({ id: `a_${a.id}`, at: a.at, kind: "task", summary: `${t.title} — ${a.summary}`, actorId: a.actorId, taskId: t.id });
    }
    for (const c of commentsFor(t.id)) {
      out.push({ id: `c_${c.id}`, at: c.createdAt, kind: "comment", summary: `Comment on ${t.title}`, actorId: c.authorId, taskId: t.id });
    }
  }

  const comm = commStore.getSnapshot();
  for (const f of comm.files) {
    if (!taskIds.has(f.taskId)) continue;
    out.push({ id: `f_${f.id}`, at: f.uploadedAt, kind: "file", summary: `Uploaded ${f.fileName}`, actorId: f.uploadedBy, taskId: f.taskId });
  }
  for (const c of comm.comments) {
    if (!taskIds.has(c.taskId)) continue;
    out.push({ id: `tc_${c.id}`, at: c.createdAt, kind: "comment", summary: c.message.slice(0, 90), actorId: c.userId, taskId: c.taskId });
  }
  for (const sp of sprintsForProject(projectId)) {
    out.push({ id: `s_${sp.id}`, at: sp.createdAt, kind: "sprint", summary: `Sprint created — ${sp.name}`, actorId: undefined });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ── Totals ──────────────────────────────────────────────────────────────

export function totalHours(logs: TimeLog[]): number {
  return Math.round((logs.reduce((acc, l) => acc + (l.durationMinutes ?? 0), 0) / 60) * 10) / 10;
}

export function avgHoursPerTask(tasks: Task[], logs: TimeLog[]): number {
  const tracked = new Set(logs.map((l) => l.taskId));
  const n = tasks.filter((t) => tracked.has(t.id)).length;
  if (!n) return 0;
  return Math.round((totalHours(logs) / n) * 10) / 10;
}

/**
 * Auto-generated UI insights & project health score.
 * Pure derivations from analytics utils — no business logic.
 */
import { snapshotTasks, filterProjectTasks, sprintProgressList, projectTimeLogs,
  totalHours, dependencyInsights, tasksPerUser } from "./utils";

export type InsightIntent = "positive" | "warning" | "negative" | "neutral";

export interface Insight {
  id: string;
  title: string;
  intent: InsightIntent;
  description?: string;
}

export function generateInsights(projectId: string): Insight[] {
  const tasks = filterProjectTasks({ projectId });
  const snap = snapshotTasks(tasks);
  const sprints = sprintProgressList(projectId);
  const active = sprints.find((s) => s.sprint.status === "active");
  const logs = projectTimeLogs(projectId);
  const stats = tasksPerUser(tasks, logs);
  const dep = dependencyInsights(tasks);
  const out: Insight[] = [];

  if (snap.completionPct >= 70) {
    out.push({ id: "vel", title: `Team velocity is strong — ${snap.completionPct}% complete`, intent: "positive" });
  } else if (snap.completionPct < 30 && snap.total > 5) {
    out.push({ id: "vel", title: `Velocity is low — only ${snap.completionPct}% delivered`, intent: "warning" });
  } else {
    out.push({ id: "vel", title: `Progress steady at ${snap.completionPct}%`, intent: "neutral" });
  }

  if (dep.blockedCount > 0) {
    out.push({ id: "blk", title: `${dep.blockedCount} ${dep.blockedCount === 1 ? "task is" : "tasks are"} blocking progress`,
      intent: dep.blockedCount > 2 ? "negative" : "warning",
      description: dep.mostBlocking ? `Top blocker: ${dep.mostBlocking}` : undefined });
  }

  if (snap.overdue > 0) {
    out.push({ id: "due", title: `${snap.overdue} overdue ${snap.overdue === 1 ? "task" : "tasks"}`, intent: "negative" });
  }

  if (stats.length) {
    const top = stats[0];
    out.push({ id: "wl", title: `Most workload assigned to ${top.name}`,
      description: `${top.total} tasks · ${top.done} done`, intent: "neutral" });
  }

  if (active) {
    out.push({ id: "spr", title: `${active.sprint.name} is ${active.pct}% complete`,
      intent: active.pct >= 70 ? "positive" : active.pct < 30 ? "warning" : "neutral" });
  }

  const hrs = totalHours(logs);
  if (hrs > 0) {
    out.push({ id: "hrs", title: `${hrs}h logged across the project`, intent: "neutral" });
  }

  return out;
}

export type HealthLevel = "good" | "at_risk" | "critical";

export interface HealthScore {
  score: number; // 0-100
  level: HealthLevel;
  factors: { label: string; value: number; weight: number }[];
}

export function calcProjectHealth(projectId: string): HealthScore {
  const tasks = filterProjectTasks({ projectId });
  const snap = snapshotTasks(tasks);
  const sprints = sprintProgressList(projectId);
  const logs = projectTimeLogs(projectId);
  const active = sprints.find((s) => s.sprint.status === "active");

  const completion = snap.completionPct;                                                // 0-100
  const blockerPenalty = Math.max(0, 100 - snap.blocked * 18 - snap.overdue * 10);      // 0-100
  const sprintHealth = active ? active.pct : sprints.length ? 60 : 70;                  // 0-100
  const timeCoverage = logs.length > 0 ? Math.min(100, 40 + logs.length * 2) : 25;      // 0-100

  const factors = [
    { label: "Task completion", value: completion, weight: 0.35 },
    { label: "Blockers & overdue", value: blockerPenalty, weight: 0.3 },
    { label: "Sprint progress", value: sprintHealth, weight: 0.2 },
    { label: "Time tracking coverage", value: timeCoverage, weight: 0.15 },
  ];
  const score = Math.round(factors.reduce((acc, f) => acc + f.value * f.weight, 0));
  const level: HealthLevel = score >= 75 ? "good" : score >= 50 ? "at_risk" : "critical";
  return { score, level, factors };
}

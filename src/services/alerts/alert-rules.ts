/**
 * Executive Alert Engine — rules.
 *
 * Each rule is a pure function: given its slice of the input and a resolved
 * threshold/`now`, it returns zero or more {@link Alert}s. Rules never read the
 * clock or do I/O (a `now` is passed in), so they are fully unit-testable and
 * deterministic. The engine composes them.
 */
import {
  type Alert,
  type AlertSeverity,
  type AttendanceAnomalyInput,
  type AiRiskInput,
  type AlertThresholds,
  type AlertType,
  type BlockerAlertInput,
  type ProjectAlertInput,
  type ReportComplianceInput,
  type SprintAlertInput,
  type WorkloadAlertInput,
  priorityForSeverity,
} from "./alert-types";

const DAY_MS = 86_400_000;

/** Whole days between two instants (>= 0 when `later` is after `earlier`). */
function daysBetween(earlier: number, later: number): number {
  return Math.floor((later - earlier) / DAY_MS);
}

interface AlertDraft {
  type: AlertType;
  category: Alert["category"];
  title: string;
  description: string;
  severity: AlertSeverity;
  entityType: string | null;
  entityId: string | null;
  evidence?: string;
  /** Escalate priority above the severity default. */
  priority?: Alert["priority"];
}

/** Build a fully-formed {@link Alert} with a stable dedupe id. */
function makeAlert(draft: AlertDraft, raisedAt: string): Alert {
  return {
    id: `${draft.type}:${draft.entityId ?? draft.title}`,
    type: draft.type,
    category: draft.category,
    title: draft.title,
    description: draft.description,
    severity: draft.severity,
    priority: draft.priority ?? priorityForSeverity(draft.severity),
    entityType: draft.entityType,
    entityId: draft.entityId,
    evidence: draft.evidence,
    raisedAt,
  };
}

const OPEN_PROJECT = new Set(["planning", "active", "on_hold"]);

/** Project overdue — an open project past its planned end date. */
export function projectOverdueRule(
  projects: ProjectAlertInput[],
  now: Date,
  raisedAt: string,
): Alert[] {
  const t = now.getTime();
  const alerts: Alert[] = [];
  for (const p of projects) {
    if (!OPEN_PROJECT.has(p.status)) continue;
    const end = Date.parse(p.endDate);
    if (!Number.isFinite(end) || end >= t) continue;

    const overdue = daysBetween(end, t);
    const severity: AlertSeverity =
      overdue > 14 || p.health === "blocked" ? "critical" : overdue > 3 ? "high" : "medium";
    alerts.push(
      makeAlert(
        {
          type: "project_overdue",
          category: "project",
          title: `${p.name} is overdue`,
          description: `Past its planned end date at ${p.progress}% progress (health: ${p.health}).`,
          severity,
          entityType: "project",
          entityId: p.id,
          evidence: `${overdue} day${overdue === 1 ? "" : "s"} overdue`,
        },
        raisedAt,
      ),
    );
  }
  return alerts;
}

/** Sprint delayed — an active sprint past its end date with work remaining. */
export function sprintDelayedRule(
  sprints: SprintAlertInput[],
  now: Date,
  raisedAt: string,
): Alert[] {
  const t = now.getTime();
  const alerts: Alert[] = [];
  for (const s of sprints) {
    if (s.status !== "active") continue;
    const end = Date.parse(s.endDate);
    const remaining = Math.max(0, s.totalTasks - s.doneTasks);
    if (!Number.isFinite(end) || end >= t || remaining === 0) continue;

    const remainingPct = s.totalTasks === 0 ? 0 : Math.round((remaining / s.totalTasks) * 100);
    const severity: AlertSeverity = remainingPct >= 40 ? "high" : "medium";
    alerts.push(
      makeAlert(
        {
          type: "sprint_delayed",
          category: "engineering",
          title: `${s.name} is delayed`,
          description: `Sprint ended with ${remaining} of ${s.totalTasks} tasks unfinished.`,
          severity,
          entityType: "sprint",
          entityId: s.id,
          evidence: `${remainingPct}% work remaining`,
        },
        raisedAt,
      ),
    );
  }
  return alerts;
}

/** Employee missing reports — expected reports not filed at/over the threshold. */
export function missingReportsRule(
  reports: ReportComplianceInput[],
  thresholds: AlertThresholds,
  raisedAt: string,
): Alert[] {
  const alerts: Alert[] = [];
  for (const r of reports) {
    if (!r.expected || r.missingReports < thresholds.missingReportsMin) continue;
    const streak = r.missedDays ?? 0;
    const severity: AlertSeverity = r.missingReports >= 3 || streak >= 3 ? "high" : "medium";
    const streakNote = streak > 1 ? ` across ${streak} days` : "";
    alerts.push(
      makeAlert(
        {
          type: "employee_missing_reports",
          category: "reports",
          title: `${r.name} is missing reports`,
          description: `${r.missingReports} of 3 daily reports not submitted${streakNote}.`,
          severity,
          entityType: "employee",
          entityId: r.userId,
          evidence: `${r.missingReports}/3 missing today`,
        },
        raisedAt,
      ),
    );
  }
  return alerts;
}

/** Attendance anomaly — repeated lateness or absence over the window. */
export function attendanceAnomalyRule(
  attendance: AttendanceAnomalyInput[],
  thresholds: AlertThresholds,
  raisedAt: string,
): Alert[] {
  const alerts: Alert[] = [];
  for (const a of attendance) {
    const absenceHit = a.absentCount >= thresholds.attendanceAbsentMin;
    const lateHit = a.lateCount >= thresholds.attendanceLateMin;
    if (!absenceHit && !lateHit) continue;

    const severity: AlertSeverity = absenceHit ? "high" : "medium";
    const parts: string[] = [];
    if (a.absentCount > 0) parts.push(`${a.absentCount} absences`);
    if (a.lateCount > 0) parts.push(`${a.lateCount} late arrivals`);
    alerts.push(
      makeAlert(
        {
          type: "attendance_anomaly",
          category: "attendance",
          title: `Attendance anomaly for ${a.name}`,
          description: `${parts.join(" and ")} in the last ${a.windowDays} days.`,
          severity,
          entityType: "employee",
          entityId: a.userId,
          evidence: parts.join(" · "),
        },
        raisedAt,
      ),
    );
  }
  return alerts;
}

/** High workload — open-task load at/over the threshold for one person. */
export function highWorkloadRule(
  workload: WorkloadAlertInput[],
  thresholds: AlertThresholds,
  raisedAt: string,
): Alert[] {
  const alerts: Alert[] = [];
  for (const w of workload) {
    if (w.openTasks < thresholds.highWorkloadTasks) continue;
    const severity: AlertSeverity =
      w.openTasks >= thresholds.highWorkloadTasks * 1.5 ? "high" : "medium";
    alerts.push(
      makeAlert(
        {
          type: "high_workload",
          category: "engineering",
          title: `${w.name} is overloaded`,
          description: `${w.openTasks} open tasks assigned — above the ${thresholds.highWorkloadTasks}-task threshold.`,
          severity,
          entityType: "employee",
          entityId: w.assigneeId,
          evidence: `${w.openTasks} open tasks`,
        },
        raisedAt,
      ),
    );
  }
  return alerts;
}

/** Critical blocker — a critical (or aged high-priority) blocker still open. */
export function criticalBlockerRule(
  blockers: BlockerAlertInput[],
  thresholds: AlertThresholds,
  raisedAt: string,
): Alert[] {
  const alerts: Alert[] = [];
  for (const b of blockers) {
    const aged = b.ageDays >= thresholds.blockerAgeDays;
    const critical = b.priority === "critical";
    const escalatedHigh = b.priority === "high" && aged;
    if (!critical && !escalatedHigh) continue;

    const severity: AlertSeverity = critical ? "critical" : "high";
    const where = b.projectName ? ` in ${b.projectName}` : "";
    alerts.push(
      makeAlert(
        {
          type: "critical_blocker",
          category: "engineering",
          title: `Critical blocker${where}`,
          description: `${b.title} — open ${b.ageDays} day${b.ageDays === 1 ? "" : "s"}${b.isBlocking ? ", blocking other work" : ""}.`,
          severity,
          entityType: "dependency",
          entityId: b.id,
          evidence: `${b.priority} · ${b.ageDays}d open`,
        },
        raisedAt,
      ),
    );
  }
  return alerts;
}

/** AI-detected risk — a risk surfaced by the AI risk-detection feature. */
export function aiRiskRule(aiRisks: AiRiskInput[], raisedAt: string): Alert[] {
  return aiRisks.map((r) =>
    makeAlert(
      {
        type: "ai_risk",
        category: "ai",
        title: r.title,
        description: r.evidence ?? "AI-detected risk from the latest analysis.",
        severity: r.severity,
        entityType: "ai_risk",
        entityId: r.id,
        evidence: r.evidence,
        // AI risks are advisory — cap urgency one notch below a hard critical.
        priority: r.severity === "critical" ? "high" : priorityForSeverity(r.severity),
      },
      raisedAt,
    ),
  );
}

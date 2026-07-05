/**
 * ExecutiveAlertEngine — evaluates the seven executive alert conditions.
 *
 * Pure and stateless: `evaluate(input)` runs every rule over the supplied
 * snapshot and returns a ranked {@link Alert}[]. Lifecycle (dismiss / archive /
 * history) is the store's job, not the engine's. Deterministic given `now`, so
 * it is fully unit-testable and safe to run on the client or server.
 */
import {
  aiRiskRule,
  attendanceAnomalyRule,
  criticalBlockerRule,
  highWorkloadRule,
  missingReportsRule,
  projectOverdueRule,
  sprintDelayedRule,
} from "./alert-rules";
import {
  type Alert,
  type AlertEngineInput,
  DEFAULT_THRESHOLDS,
  PRIORITY_RANK,
  SEVERITY_RANK,
} from "./alert-types";

/** Rank alerts: priority, then severity, then most-recent first. */
export function compareAlerts(a: Alert, b: Alert): number {
  return (
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    Date.parse(b.raisedAt) - Date.parse(a.raisedAt)
  );
}

export class ExecutiveAlertEngine {
  /** Evaluate all rules and return a ranked list of alerts. */
  evaluate(input: AlertEngineInput): Alert[] {
    const now = input.now ?? new Date();
    const raisedAt = now.toISOString();
    const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };

    const alerts: Alert[] = [
      ...projectOverdueRule(input.projects ?? [], now, raisedAt),
      ...sprintDelayedRule(input.sprints ?? [], now, raisedAt),
      ...missingReportsRule(input.reports ?? [], thresholds, raisedAt),
      ...attendanceAnomalyRule(input.attendance ?? [], thresholds, raisedAt),
      ...highWorkloadRule(input.workload ?? [], thresholds, raisedAt),
      ...criticalBlockerRule(input.blockers ?? [], thresholds, raisedAt),
      ...aiRiskRule(input.aiRisks ?? [], raisedAt),
    ];

    return alerts.sort(compareAlerts);
  }
}

/** Shared singleton — import this, not the class. */
export const executiveAlertEngine = new ExecutiveAlertEngine();

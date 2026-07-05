/**
 * Executive Alert Engine.
 *
 * `executiveAlertEngine.evaluate(input)` turns operational snapshots into ranked
 * alerts. Rules are re-exported for direct use in tests. See
 * `docs/EXECUTIVE_ALERTS.md`.
 */
export { ExecutiveAlertEngine, executiveAlertEngine, compareAlerts } from "./alert-engine";
export * from "./alert-rules";
export type * from "./alert-types";
export {
  ALERT_TYPES,
  DEFAULT_THRESHOLDS,
  PRIORITY_RANK,
  SEVERITY_RANK,
  priorityForSeverity,
} from "./alert-types";

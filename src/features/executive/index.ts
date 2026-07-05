/**
 * Executive dashboard feature — the owner cockpit.
 *
 * Composes nine sections (Overview, Company KPIs, Projects, Engineering, HR,
 * Attendance, AI Insights, Activity Timeline, Upcoming Risks) from reusable
 * widgets and the shared analytics charts. KPIs are computed by
 * `@/services/kpi`; see `docs/EXECUTIVE_DASHBOARD.md`.
 */
export { ExecutiveDashboard } from "./executive-dashboard";
export { KpiCard, KpiCardGrid } from "./components/kpi-card";
export { DashboardSection } from "./components/dashboard-section";
export { ExecutiveSummaries } from "./components/executive-summaries";
export {
  EXECUTIVE_SUMMARY_TOPICS,
  generateExecutiveSummary,
  type ExecutiveSummaryTopic,
} from "./ai/executive-summaries";
export { useExecutiveSummaries } from "./hooks/use-executive-summaries";
export { AlertsSection } from "./components/alerts-section";
export { OrganizationHealthSection } from "./components/organization-health-section";
export { deriveOrganizationHealthInput } from "./health/organization-health";
export type { OrganizationHealthExtras } from "./health/organization-health";
export { useExecutiveAlerts } from "./hooks/use-executive-alerts";
export type { StoredAlert, AlertEvent } from "./alerts/alert-store";
export type * from "./types";

import { useMemo } from "react";
import { executiveKpiService } from "@/services/kpi";
import {
  attendancePulse,
  executiveKpiInput,
  hrPulse,
  insights,
  projectHealth,
  risks,
  timeline,
  trends,
} from "./mock-data";
import { ActivityTimelineSection } from "./components/activity-timeline-section";
import { AiInsightsSection } from "./components/ai-insights-section";
import { AlertsSection } from "./components/alerts-section";
import { AttendanceSection } from "./components/attendance-section";
import { CompanySection } from "./components/company-section";
import { EngineeringSection } from "./components/engineering-section";
import { HrSection } from "./components/hr-section";
import { OrganizationHealthSection } from "./components/organization-health-section";
import { OverviewSection } from "./components/overview-section";
import { ProjectsSection } from "./components/projects-section";
import { UpcomingRisksSection } from "./components/upcoming-risks-section";

const SUMMARY =
  "Delivery is accelerating — throughput is up 18% over six weeks and velocity holds at ~38 pts. " +
  "Attendance (91%) and productivity (85) are both trending up. The main risks are Orbit's blocked " +
  "payments API and the overdue Atlas migration; end-of-day reporting also dipped below target.";

/**
 * Executive Dashboard — the owner cockpit. Composes the dashboard sections from
 * reusable widgets and the shared analytics charts. KPIs are **computed** by the
 * `executiveKpiService` and alerts by the `executiveAlertEngine`, both from
 * snapshots (see `mock-data.ts`) — no metric or rule logic is duplicated here.
 */
export function ExecutiveDashboard() {
  const kpis = useMemo(() => executiveKpiService.computeAll(executiveKpiInput), []);

  return (
    <div className="space-y-8">
      <OverviewSection kpis={kpis} summary={SUMMARY} />
      <OrganizationHealthSection kpis={kpis} />
      <AlertsSection />
      <CompanySection kpis={kpis.company} />
      <ProjectsSection kpis={kpis.projects} throughput={trends.throughput} health={projectHealth} />
      <EngineeringSection kpis={kpis.engineering} velocity={trends.velocity} />
      <HrSection pulse={hrPulse} />
      <AttendanceSection pulse={attendancePulse} />
      <AiInsightsSection insights={insights} />
      <ActivityTimelineSection events={timeline} />
      <UpcomingRisksSection risks={risks} />
    </div>
  );
}

/**
 * Organization Health adapter.
 *
 * Derives the `OrganizationHealthInput` factor scores from the **already
 * computed** KPI groups (`executiveKpiService`) plus HR / attendance / AI extras.
 * This is where domain KPIs are normalized into 0–100 "goodness" factors; the
 * health scoring + banding itself lives in `@/services/health`. Swap this for a
 * live adapter without touching the health service or the UI.
 */
import type { ExecutiveKpis } from "@/services/kpi";
import type { AiConfidenceInput, OrganizationHealthInput } from "@/services/health";
import type { AttendancePulse, HrPulse } from "../types";

const clamp100 = (n: number): number => Math.min(100, Math.max(0, n));

/** Target velocity used to score velocity attainment. */
const TARGET_VELOCITY = 40;
/** Healthy utilization midpoint; distance from it lowers the capacity factor. */
const IDEAL_UTILIZATION = 88;

export interface OrganizationHealthExtras {
  hr: HrPulse;
  attendance: AttendancePulse;
  /** Dependencies opened vs resolved over the window (collaboration flow). */
  dependencyFlow: { opened: number; resolved: number };
  /** AI grounding coverage/quality/agreement (0–100 each). */
  aiConfidence: AiConfidenceInput;
}

export function deriveOrganizationHealthInput(
  kpis: ExecutiveKpis,
  extras: OrganizationHealthExtras,
): OrganizationHealthInput {
  const eng = kpis.engineering;
  const openTasks = eng.workload.buckets.reduce((sum, b) => sum + b.openTasks, 0);
  const blocked = eng.blockedTasks.value;

  const engineering = {
    velocityAttainment: clamp100((eng.sprintVelocity.value / TARGET_VELOCITY) * 100),
    flow: clamp100(100 - (blocked / Math.max(openTasks + blocked, 1)) * 100),
    capacity: clamp100(100 - Math.abs(eng.teamCapacity.value - IDEAL_UTILIZATION) * 2),
    balance: eng.workloadBalance.value,
  };

  const { hr: hrPulse } = extras;
  const hr = {
    retention: clamp100(
      100 - (hrPulse.offboarding / Math.max(hrPulse.totalHeadcount, 1)) * 100 * 2,
    ),
    staffing: clamp100((hrPulse.activeHeadcount / Math.max(hrPulse.totalHeadcount, 1)) * 100),
    onboarding: clamp100(100 - hrPulse.newHires30d * 3),
  };

  const project = {
    onTrackRatio: clamp100(
      100 -
        (kpis.projects.delayedProjects.value / Math.max(kpis.projects.activeProjects.value, 1)) *
          100,
    ),
    completionRate: kpis.projects.completionRate.value,
    deliverySuccess: kpis.projects.deliverySuccessRate.value,
  };

  const att = extras.attendance;
  const attendance = {
    attendanceRate: kpis.company.attendanceRate.value,
    punctuality: clamp100((att.present / Math.max(att.present + att.late, 1)) * 100),
    anomalyLoad: clamp100(
      100 - ((att.late + att.absent) / Math.max(kpis.company.activeEmployees.value, 1)) * 100 * 2,
    ),
  };

  const flow = extras.dependencyFlow;
  const collaboration = {
    reportCompletion: kpis.reports.reportCompletion.value,
    // A ~15-minute response is excellent; each extra minute costs a few points.
    responsiveness: clamp100(100 - Math.max(0, kpis.reports.avgResponseTime.value - 15) * 3),
    dependencyFlow: clamp100((flow.resolved / Math.max(flow.opened, 1)) * 100),
  };

  return {
    engineering,
    hr,
    project,
    attendance,
    collaboration,
    aiConfidence: extras.aiConfidence,
  };
}

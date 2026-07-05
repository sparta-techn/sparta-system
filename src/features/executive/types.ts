/**
 * Executive dashboard — section view-models.
 *
 * KPI shapes come from the reusable KPI service (`@/services/kpi`); this file
 * only adds the small extras that are section-specific (risks, HR/attendance
 * pulses) and not point-in-time KPIs. Trend series reuse the analytics
 * `TrendPoint`, insights reuse the analytics `Insight`, and timeline events
 * reuse the chart `TimelineEvent` — nothing is re-declared.
 */
import type { Insight, TrendPoint } from "@/features/analytics/types";

export type RiskSeverity = "high" | "medium" | "low";

export type RiskArea = "project" | "engineering" | "hr" | "attendance" | "reports";

/** An upcoming operational risk surfaced to leadership. */
export interface ExecRisk {
  id: string;
  title: string;
  severity: RiskSeverity;
  /** Team / person accountable. */
  owner: string;
  area: RiskArea;
  /** Human-readable horizon, e.g. "in 2 days". */
  dueLabel: string;
}

export interface DepartmentHeadcount {
  name: string;
  headcount: number;
}

/** HR section pulse — headcount movement + department split. */
export interface HrPulse {
  totalHeadcount: number;
  activeHeadcount: number;
  newHires30d: number;
  offboarding: number;
  birthdaysThisWeek: number;
  byDepartment: DepartmentHeadcount[];
}

/** Attendance section pulse — today's split + a weekly trend. */
export interface AttendancePulse {
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  /** Weekly on-time attendance %, for the trend line. */
  trend: TrendPoint[];
}

/** Trend series reused across the Projects / Engineering charts. */
export interface DashboardTrends {
  /** Weekly attendance compliance %. */
  attendance: TrendPoint[];
  /** Weekly report compliance %. */
  reportCompliance: TrendPoint[];
  /** Completed story points per recent sprint. */
  velocity: TrendPoint[];
  /** Weekly delivered tasks. */
  throughput: TrendPoint[];
  /** Dependencies opened per week. */
  depsOpened: TrendPoint[];
  /** Dependencies resolved per week. */
  depsResolved: TrendPoint[];
}

/** Per-project health row for the Projects table. */
export interface ProjectHealthRow {
  id: string;
  name: string;
  status: "On track" | "At risk" | "Delayed" | "Completed";
  progress: number;
  openBlockers: number;
  owner: string;
}

export type { Insight };

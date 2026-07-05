/**
 * Extras for the Organization Health adapter that aren't in the KPI groups.
 * Reuses the dashboard's HR / attendance / dependency-trend seed data; swap for
 * a live adapter alongside the rest of `mock-data`.
 */
import type { TrendPoint } from "@/features/analytics/types";
import { attendancePulse, hrPulse, trends } from "../mock-data";
import type { OrganizationHealthExtras } from "./organization-health";

const sum = (points: TrendPoint[]): number => points.reduce((s, p) => s + p.value, 0);

export const organizationHealthExtras: OrganizationHealthExtras = {
  hr: hrPulse,
  attendance: attendancePulse,
  dependencyFlow: { opened: sum(trends.depsOpened), resolved: sum(trends.depsResolved) },
  // AI grounding: strong coverage, good quality, slightly lower cross-signal agreement.
  aiConfidence: { dataCoverage: 90, groundingQuality: 84, signalAgreement: 78 },
};

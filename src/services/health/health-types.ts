/**
 * Organization Health — types.
 *
 * Health metrics are a higher-order composite **over the KPI layer**: each
 * domain health is a weighted blend of 0–100 factor scores, mapped to a
 * four-level band. The calculators are pure (see `health-calculators.ts`); the
 * factor scores are derived from the KPI service output by the feature adapter,
 * so no metric math is duplicated.
 */

/** The four display bands, worst → best rank in `BAND_RANK`. */
export type HealthBand = "critical" | "needs_attention" | "good" | "excellent";

/** Human labels for the bands (as required by the dashboard). */
export const BAND_LABEL: Record<HealthBand, string> = {
  excellent: "Excellent",
  good: "Good",
  needs_attention: "Needs Attention",
  critical: "Critical",
};

export const BAND_RANK: Record<HealthBand, number> = {
  critical: 0,
  needs_attention: 1,
  good: 2,
  excellent: 3,
};

/** Score → band cutoffs (inclusive lower bounds). */
export interface BandThresholds {
  excellent: number;
  good: number;
  needsAttention: number;
}

export const DEFAULT_BANDS: BandThresholds = {
  excellent: 85,
  good: 70,
  needsAttention: 50,
};

/** A single 0–100 factor contributing to a health metric. */
export interface HealthFactor {
  label: string;
  /** 0–100 "goodness" score (higher is always better). */
  value: number;
  /** Relative weight within the metric. */
  weight: number;
}

/** A computed health metric. */
export interface HealthMetric {
  key: string;
  label: string;
  /** 0–100 composite score. */
  score: number;
  band: HealthBand;
  /** One-line read of the band. */
  summary: string;
  /** Contributing factors, for drill-down. */
  factors: { label: string; value: number }[];
}

// ── Domain factor inputs (all fields are 0–100 goodness scores) ──────────────

export interface EngineeringHealthInput {
  /** Velocity attained vs target. */
  velocityAttainment: number;
  /** Flow — inverse of blocked-work load. */
  flow: number;
  /** Capacity — closeness to a healthy utilization band. */
  capacity: number;
  /** Workload balance across the team. */
  balance: number;
}

export interface HrHealthInput {
  /** Retention / low attrition. */
  retention: number;
  /** Staffing level vs plan (active headcount). */
  staffing: number;
  /** Onboarding / ramp health. */
  onboarding: number;
}

export interface ProjectHealthInput {
  /** Share of projects on track (not delayed/blocked). */
  onTrackRatio: number;
  /** Portfolio completion rate. */
  completionRate: number;
  /** On-time delivery success. */
  deliverySuccess: number;
}

export interface AttendanceHealthInput {
  /** Present vs expected. */
  attendanceRate: number;
  /** On-time / punctuality. */
  punctuality: number;
  /** Inverse of anomaly load. */
  anomalyLoad: number;
}

export interface CollaborationHealthInput {
  /** Daily report completion. */
  reportCompletion: number;
  /** Responsiveness (inverse of response time). */
  responsiveness: number;
  /** Dependency flow (resolved vs opened). */
  dependencyFlow: number;
}

export interface AiConfidenceInput {
  /** Fraction of domains with fresh, sufficient data. */
  dataCoverage: number;
  /** Quality of grounding available to the AI. */
  groundingQuality: number;
  /** Consistency/agreement across AI signals. */
  signalAgreement: number;
}

/** Relative weights of each domain in the Overall Organization Score. */
export interface OverallWeights {
  engineering: number;
  hr: number;
  project: number;
  attendance: number;
  collaboration: number;
  aiConfidence: number;
}

/** AI Confidence is advisory, so it carries the lightest default weight. */
export const DEFAULT_OVERALL_WEIGHTS: OverallWeights = {
  engineering: 0.22,
  hr: 0.15,
  project: 0.22,
  attendance: 0.16,
  collaboration: 0.15,
  aiConfidence: 0.1,
};

export interface OrganizationHealthInput {
  engineering: EngineeringHealthInput;
  hr: HrHealthInput;
  project: ProjectHealthInput;
  attendance: AttendanceHealthInput;
  collaboration: CollaborationHealthInput;
  aiConfidence: AiConfidenceInput;
  weights?: Partial<OverallWeights>;
  bands?: BandThresholds;
}

export interface OrganizationHealth {
  engineering: HealthMetric;
  hr: HealthMetric;
  project: HealthMetric;
  attendance: HealthMetric;
  collaboration: HealthMetric;
  aiConfidence: HealthMetric;
  /** Overall Organization Score. */
  overall: HealthMetric;
}

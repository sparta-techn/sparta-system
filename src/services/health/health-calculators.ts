/**
 * Organization Health — pure calculators.
 *
 * Each domain metric is a weighted blend of 0–100 factor scores mapped to a
 * {@link HealthBand}. The Overall Organization Score is a weighted blend of the
 * six domain scores. No I/O, deterministic — fully unit-testable.
 */
import {
  type AiConfidenceInput,
  type AttendanceHealthInput,
  type BandThresholds,
  type CollaborationHealthInput,
  type EngineeringHealthInput,
  type HealthBand,
  type HealthFactor,
  type HealthMetric,
  type HrHealthInput,
  type OrganizationHealth,
  type OrganizationHealthInput,
  type OverallWeights,
  type ProjectHealthInput,
  DEFAULT_BANDS,
  DEFAULT_OVERALL_WEIGHTS,
} from "./health-types";

/** Round to 1dp, avoiding `-0`. */
function round(n: number): number {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r;
}

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** Weighted average of factor values (weights need not sum to 1). */
export function weightedScore(factors: HealthFactor[]): number {
  const total = factors.reduce((sum, f) => sum + f.weight, 0);
  if (total === 0) return 0;
  const raw = factors.reduce((sum, f) => sum + clamp100(f.value) * f.weight, 0);
  return round(raw / total);
}

/** Map a 0–100 score to a band. */
export function bandForScore(score: number, bands: BandThresholds = DEFAULT_BANDS): HealthBand {
  if (score >= bands.excellent) return "excellent";
  if (score >= bands.good) return "good";
  if (score >= bands.needsAttention) return "needs_attention";
  return "critical";
}

const BAND_SUMMARY: Record<HealthBand, string> = {
  excellent: "Strong and stable.",
  good: "Healthy with minor watch-points.",
  needs_attention: "Slipping — worth a closer look.",
  critical: "Needs intervention now.",
};

/** Assemble a {@link HealthMetric} from weighted factors. */
function metric(
  key: string,
  label: string,
  factors: HealthFactor[],
  bands: BandThresholds,
): HealthMetric {
  const score = weightedScore(factors);
  const band = bandForScore(score, bands);
  return {
    key,
    label,
    score,
    band,
    summary: BAND_SUMMARY[band],
    factors: factors.map((f) => ({ label: f.label, value: round(f.value) })),
  };
}

// ── Domain metrics ───────────────────────────────────────────────────────────

export function engineeringHealth(
  input: EngineeringHealthInput,
  bands = DEFAULT_BANDS,
): HealthMetric {
  return metric(
    "engineering",
    "Engineering Health",
    [
      { label: "Velocity attainment", value: input.velocityAttainment, weight: 0.3 },
      { label: "Flow (blockers)", value: input.flow, weight: 0.3 },
      { label: "Capacity", value: input.capacity, weight: 0.2 },
      { label: "Workload balance", value: input.balance, weight: 0.2 },
    ],
    bands,
  );
}

export function hrHealth(input: HrHealthInput, bands = DEFAULT_BANDS): HealthMetric {
  return metric(
    "hr",
    "HR Health",
    [
      { label: "Retention", value: input.retention, weight: 0.4 },
      { label: "Staffing", value: input.staffing, weight: 0.35 },
      { label: "Onboarding", value: input.onboarding, weight: 0.25 },
    ],
    bands,
  );
}

export function projectHealth(input: ProjectHealthInput, bands = DEFAULT_BANDS): HealthMetric {
  return metric(
    "project",
    "Project Health",
    [
      { label: "On-track ratio", value: input.onTrackRatio, weight: 0.4 },
      { label: "Completion rate", value: input.completionRate, weight: 0.3 },
      { label: "Delivery success", value: input.deliverySuccess, weight: 0.3 },
    ],
    bands,
  );
}

export function attendanceHealth(
  input: AttendanceHealthInput,
  bands = DEFAULT_BANDS,
): HealthMetric {
  return metric(
    "attendance",
    "Attendance Health",
    [
      { label: "Attendance rate", value: input.attendanceRate, weight: 0.45 },
      { label: "Punctuality", value: input.punctuality, weight: 0.3 },
      { label: "Anomaly load", value: input.anomalyLoad, weight: 0.25 },
    ],
    bands,
  );
}

export function collaborationHealth(
  input: CollaborationHealthInput,
  bands = DEFAULT_BANDS,
): HealthMetric {
  return metric(
    "collaboration",
    "Collaboration Health",
    [
      { label: "Report completion", value: input.reportCompletion, weight: 0.35 },
      { label: "Responsiveness", value: input.responsiveness, weight: 0.3 },
      { label: "Dependency flow", value: input.dependencyFlow, weight: 0.35 },
    ],
    bands,
  );
}

export function aiConfidence(input: AiConfidenceInput, bands = DEFAULT_BANDS): HealthMetric {
  return metric(
    "ai_confidence",
    "AI Confidence",
    [
      { label: "Data coverage", value: input.dataCoverage, weight: 0.4 },
      { label: "Grounding quality", value: input.groundingQuality, weight: 0.35 },
      { label: "Signal agreement", value: input.signalAgreement, weight: 0.25 },
    ],
    bands,
  );
}

/** Overall Organization Score — weighted blend of the six domain scores. */
export function overallOrganizationScore(
  domains: {
    engineering: HealthMetric;
    hr: HealthMetric;
    project: HealthMetric;
    attendance: HealthMetric;
    collaboration: HealthMetric;
    aiConfidence: HealthMetric;
  },
  weights?: Partial<OverallWeights>,
  bands = DEFAULT_BANDS,
): HealthMetric {
  const w: OverallWeights = { ...DEFAULT_OVERALL_WEIGHTS, ...weights };
  return metric(
    "overall",
    "Overall Organization Score",
    [
      { label: "Engineering", value: domains.engineering.score, weight: w.engineering },
      { label: "HR", value: domains.hr.score, weight: w.hr },
      { label: "Project", value: domains.project.score, weight: w.project },
      { label: "Attendance", value: domains.attendance.score, weight: w.attendance },
      { label: "Collaboration", value: domains.collaboration.score, weight: w.collaboration },
      { label: "AI Confidence", value: domains.aiConfidence.score, weight: w.aiConfidence },
    ],
    bands,
  );
}

/** Compute all seven health metrics from a single input. */
export function computeOrganizationHealth(input: OrganizationHealthInput): OrganizationHealth {
  const bands = input.bands ?? DEFAULT_BANDS;
  const engineering = engineeringHealth(input.engineering, bands);
  const hr = hrHealth(input.hr, bands);
  const project = projectHealth(input.project, bands);
  const attendance = attendanceHealth(input.attendance, bands);
  const collaboration = collaborationHealth(input.collaboration, bands);
  const ai = aiConfidence(input.aiConfidence, bands);
  const overall = overallOrganizationScore(
    { engineering, hr, project, attendance, collaboration, aiConfidence: ai },
    input.weights,
    bands,
  );
  return { engineering, hr, project, attendance, collaboration, aiConfidence: ai, overall };
}

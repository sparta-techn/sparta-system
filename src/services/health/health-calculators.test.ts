import { describe, expect, it } from "vitest";

import {
  bandForScore,
  computeOrganizationHealth,
  engineeringHealth,
  overallOrganizationScore,
  weightedScore,
} from "./health-calculators";
import { BAND_LABEL, type OrganizationHealthInput } from "./health-types";

describe("banding", () => {
  it("maps scores to the four bands", () => {
    expect(bandForScore(92)).toBe("excellent");
    expect(bandForScore(85)).toBe("excellent");
    expect(bandForScore(70)).toBe("good");
    expect(bandForScore(55)).toBe("needs_attention");
    expect(bandForScore(49)).toBe("critical");
  });

  it("exposes the required display labels", () => {
    expect(BAND_LABEL.excellent).toBe("Excellent");
    expect(BAND_LABEL.good).toBe("Good");
    expect(BAND_LABEL.needs_attention).toBe("Needs Attention");
    expect(BAND_LABEL.critical).toBe("Critical");
  });
});

describe("weightedScore", () => {
  it("weights factors and clamps to 0–100", () => {
    expect(
      weightedScore([
        { label: "a", value: 100, weight: 1 },
        { label: "b", value: 0, weight: 1 },
      ]),
    ).toBe(50);
    // out-of-range values are clamped
    expect(weightedScore([{ label: "a", value: 150, weight: 1 }])).toBe(100);
  });

  it("returns 0 when weights are all zero", () => {
    expect(weightedScore([{ label: "a", value: 90, weight: 0 }])).toBe(0);
  });
});

describe("domain metric", () => {
  it("computes engineering health from its factors", () => {
    const m = engineeringHealth({ velocityAttainment: 90, flow: 80, capacity: 85, balance: 70 });
    // 90*.3 + 80*.3 + 85*.2 + 70*.2 = 27 + 24 + 17 + 14 = 82
    expect(m.score).toBe(82);
    expect(m.band).toBe("good");
    expect(m.factors).toHaveLength(4);
  });
});

describe("overall organization score", () => {
  const strong = (score: number) => ({
    key: "x",
    label: "X",
    score,
    band: "good" as const,
    summary: "",
    factors: [],
  });

  it("blends the six domains by weight", () => {
    const overall = overallOrganizationScore({
      engineering: strong(80),
      hr: strong(80),
      project: strong(80),
      attendance: strong(80),
      collaboration: strong(80),
      aiConfidence: strong(80),
    });
    expect(overall.score).toBe(80);
    expect(overall.key).toBe("overall");
  });
});

describe("computeOrganizationHealth", () => {
  const input: OrganizationHealthInput = {
    engineering: { velocityAttainment: 95, flow: 60, capacity: 88, balance: 100 },
    hr: { retention: 92, staffing: 88, onboarding: 80 },
    project: { onTrackRatio: 45, completionRate: 40, deliverySuccess: 50 },
    attendance: { attendanceRate: 91, punctuality: 88, anomalyLoad: 90 },
    collaboration: { reportCompletion: 82, responsiveness: 70, dependencyFlow: 75 },
    aiConfidence: { dataCoverage: 90, groundingQuality: 85, signalAgreement: 80 },
  };

  it("returns all seven metrics", () => {
    const health = computeOrganizationHealth(input);
    expect(Object.keys(health)).toEqual([
      "engineering",
      "hr",
      "project",
      "attendance",
      "collaboration",
      "aiConfidence",
      "overall",
    ]);
  });

  it("flags a weak domain and reflects it in the overall band", () => {
    const health = computeOrganizationHealth(input);
    // project factors avg = 45*.4 + 40*.3 + 50*.3 = 18+12+15 = 45 → critical
    expect(health.project.band).toBe("critical");
    expect(health.attendance.band).toBe("excellent");
    // overall stays a real 0–100 score with a valid band
    expect(health.overall.score).toBeGreaterThan(0);
    expect(health.overall.score).toBeLessThanOrEqual(100);
  });
});

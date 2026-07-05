/**
 * Owner AI features — company-wide summaries, health, risk and weekly insights.
 * Grounding is owner-scoped by the service layer. Template-backed where a Prompt
 * Library entry exists; inline for insight/risk detection.
 */

import { getPrompt, renderRequest } from "../prompts";
import type { AIFeatureDefinition } from "./types";

const executiveSummary: AIFeatureDefinition = {
  id: "executive-summary",
  title: "Executive Summary",
  audience: "owner",
  description: "One-page leadership summary: delivery, metrics, risks, decisions.",
  build: (input) => renderRequest(getPrompt("executive-summary"), input.variables),
};

const companyHealth: AIFeatureDefinition = {
  id: "company-health",
  title: "Company Health",
  audience: "owner",
  description: "Overall company health from projects, analytics, attendance and dependencies.",
  build: (input) => renderRequest(getPrompt("company-health"), input.variables),
};

const riskDetection: AIFeatureDefinition = {
  id: "risk-detection",
  title: "Risk Detection",
  audience: "owner",
  description: "Detect and rank the company's top risks with evidence and mitigations.",
  build: () => ({
    surface: "analytics",
    prompt: `From the projects, analytics and dependencies in <context>, detect the company's top risks. For each risk, ranked by severity:
- A short description and the evidence in the context.
- Likelihood and impact.
- The owner and current state.
- A suggested mitigation.
Ground strictly in the context; flag any low-confidence inference.`,
  }),
};

const weeklyInsights: AIFeatureDefinition = {
  id: "weekly-insights",
  title: "Weekly Insights",
  audience: "owner",
  description: "This week's key trends, changes, emerging risks and recommended actions.",
  build: () => ({
    surface: "analytics",
    prompt: `From the projects, analytics and reports in <context>, produce this week's key insights for leadership:
- Notable trends and what changed week-over-week.
- Emerging risks worth watching.
- 3 recommended actions.
Keep it crisp and quantitative where the context allows; do not invent metrics.`,
  }),
};

export const OWNER_FEATURES: AIFeatureDefinition[] = [
  executiveSummary,
  companyHealth,
  riskDetection,
  weeklyInsights,
];

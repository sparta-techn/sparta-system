/**
 * Executive summary AI features — the six leadership summaries that power the
 * Executive Dashboard's AI panel.
 *
 * Each is a normal owner-scoped {@link AIFeatureDefinition}: it produces a
 * `{ surface, prompt }` request that the shared {@link AIAssistantService} runs
 * through the context engine + prompt builder + provider. There is **no
 * provider-specific logic here** — grounding surfaces are reused from
 * `SURFACE_SOURCES`, and Company Health delegates to the existing
 * `company-health` prompt template rather than duplicating it.
 */

import { getPrompt, renderRequest } from "../prompts";
import type { AIFeatureDefinition } from "./types";

/** Company Health — reuses the existing owner `company-health` template. */
const companyHealth: AIFeatureDefinition = {
  id: "executive-company-health",
  title: "Company Health",
  audience: "owner",
  description: "Overall company health from projects, analytics, attendance and dependencies.",
  build: (input) => renderRequest(getPrompt("company-health"), input.variables),
};

const teamPerformance: AIFeatureDefinition = {
  id: "executive-team-performance",
  title: "Team Performance",
  audience: "owner",
  description: "How teams are performing on reports, attendance and workload.",
  build: () => ({
    surface: "reports",
    prompt: `From the daily reports, attendance and time-tracking in <context>, summarise team performance for leadership:
- Overall performance read (strong / steady / lagging) with the rationale.
- Report compliance and where it is slipping.
- Workload and utilisation signals across teams.
- 2–3 teams or areas that need attention.
Stay grounded in the context; do not invent metrics.`,
  }),
};

const projectRisks: AIFeatureDefinition = {
  id: "executive-project-risks",
  title: "Project Risks",
  audience: "owner",
  description: "Top project delivery risks with evidence and mitigations.",
  build: () => ({
    surface: "projects",
    prompt: `From the projects, sprints and tasks in <context>, identify the top project delivery risks, ranked by severity. For each:
- The project and a short description of the risk.
- The evidence in the context (slipping progress, blocked work, past-due dates).
- Likely impact and a suggested mitigation with an owner.
Ground strictly in the context; flag any low-confidence inference.`,
  }),
};

const attendanceTrends: AIFeatureDefinition = {
  id: "executive-attendance-trends",
  title: "Attendance Trends",
  audience: "owner",
  description: "Attendance and punctuality trends across the company.",
  build: () => ({
    surface: "analytics",
    prompt: `From the attendance data in <context>, summarise company attendance trends:
- Overall attendance and on-time rate, and how they are trending.
- Notable changes (rising lateness, absence clusters, leave load).
- Any teams or patterns worth a closer look.
Be quantitative where the context allows; do not invent numbers.`,
  }),
};

const engineeringProductivity: AIFeatureDefinition = {
  id: "executive-engineering-productivity",
  title: "Engineering Productivity",
  audience: "owner",
  description: "Engineering throughput, velocity and blockers.",
  build: () => ({
    surface: "sprints",
    prompt: `From the sprints and tasks in <context>, summarise engineering productivity:
- Velocity and throughput, and their trend across recent sprints.
- Blocked or stalled work and its concentration.
- How load is spread across the team.
- 2–3 levers to improve delivery flow.
Keep it crisp and grounded in the context.`,
  }),
};

const deliveryForecast: AIFeatureDefinition = {
  id: "executive-delivery-forecast",
  title: "Delivery Forecast",
  audience: "owner",
  description: "Forward-looking delivery outlook from velocity and remaining scope.",
  build: () => ({
    surface: "sprints",
    prompt: `From the sprints, tasks and progress in <context>, produce a delivery forecast for leadership:
- The likely outlook for the current sprint / near-term milestones (on-track / at-risk / behind).
- What the trend in velocity vs remaining scope implies.
- The main assumptions and risks to the forecast.
- What would most improve the odds of on-time delivery.
Reason only from the context; state clearly when data is insufficient to forecast.`,
  }),
};

/** The six executive summaries, in dashboard display order. */
export const EXECUTIVE_FEATURES: AIFeatureDefinition[] = [
  companyHealth,
  teamPerformance,
  projectRisks,
  attendanceTrends,
  engineeringProductivity,
  deliveryForecast,
];

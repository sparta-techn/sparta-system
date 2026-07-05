/**
 * Owner prompt templates — company-wide health, executive and periodic reports.
 *
 * These rely on analytics/project grounding gathered through the service layer
 * (owner-scoped by RLS). Prompts push the model to stay quantitative where the
 * context allows and to avoid inventing metrics.
 */

import type { PromptTemplate } from "../../types";

const companyHealth: PromptTemplate = {
  id: "company-health",
  title: "Company Health",
  audience: "owner",
  description: "Overall company health from projects, analytics, attendance and dependencies.",
  surface: "analytics",
  sources: ["profile", "projects", "time_tracking", "attendance", "dependencies"],
  variables: [{ key: "date", description: "As-of date", default: "today" }],
  template: `Give me an overall company health assessment using the projects, analytics, attendance and dependencies in <context> as of {{date}}.

Cover:
- Headline health (healthy / at-risk / blocked), with the rationale.
- Delivery: project progress and any red projects.
- People: attendance and workload signals.
- Cross-team blockers and overall dependency load.
- The top 3 things to address this week.`,
};

const executiveSummary: PromptTemplate = {
  id: "executive-summary",
  title: "Executive Summary",
  audience: "owner",
  description: "Concise, one-page leadership summary of delivery, metrics, risks and decisions.",
  surface: "analytics",
  sources: ["projects", "time_tracking", "attendance"],
  variables: [{ key: "period", description: "Period to cover", default: "this week" }],
  template: `Write a concise executive summary for leadership using the projects, analytics and key metrics in <context> for {{period}}.

One page, structured:
- TL;DR (3 bullets).
- Delivery highlights and misses.
- Key metrics and their trend direction.
- Risks and the decisions needed.

Keep it crisp and quantitative wherever the context allows.`,
};

const weeklyReport: PromptTemplate = {
  id: "weekly-report",
  title: "Weekly Report",
  audience: "owner",
  description:
    "Company weekly report: exec summary, per-project progress, people, risks, priorities.",
  surface: "analytics",
  sources: ["projects", "daily_reports", "attendance", "dependencies", "time_tracking"],
  variables: [
    { key: "week_start", description: "Week start date (YYYY-MM-DD)", required: true },
    { key: "week_end", description: "Week end date (YYYY-MM-DD)", required: true },
  ],
  template: `Produce the company weekly report for {{week_start}} to {{week_end}} from the projects, analytics, reports and dependencies in <context>.

Sections:
- Executive summary (3–5 bullets).
- Progress by project (status, health, notable movement).
- People & attendance highlights.
- Risks & blockers, with owners.
- Priorities for next week.`,
};

const monthlyReport: PromptTemplate = {
  id: "monthly-report",
  title: "Monthly Report",
  audience: "owner",
  description: "Company monthly report: delivery, operational trends, wins/setbacks, strategy.",
  surface: "analytics",
  sources: ["projects", "time_tracking", "attendance", "dependencies"],
  variables: [{ key: "month", description: "Month to cover (e.g. 2026-06)", required: true }],
  template: `Produce the company monthly report for {{month}} using the projects, analytics and trends in <context>.

Sections:
- Executive summary.
- Delivery: completed milestones and project-health trajectory over the month.
- Operational metrics and trends (attendance, throughput, dependency load).
- Wins and setbacks.
- Strategic risks and recommendations for next month.`,
};

export const OWNER_TEMPLATES: PromptTemplate[] = [
  companyHealth,
  executiveSummary,
  weeklyReport,
  monthlyReport,
];

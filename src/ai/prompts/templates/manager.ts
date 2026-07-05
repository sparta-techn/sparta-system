/**
 * Manager prompt templates — team-level summaries, reviews and risk analysis.
 *
 * Grounding is gathered through the service layer, which scopes rows by RLS: a
 * manager sees their team's reports/tasks/dependencies, nothing more. Prompts
 * instruct the model to base every claim on that context and flag gaps.
 */

import type { PromptTemplate } from "../../types";

const teamSummary: PromptTemplate = {
  id: "team-summary",
  title: "Team Summary",
  audience: "manager",
  description: "Current team status from reports, tasks, attendance and dependencies.",
  surface: "reports",
  sources: ["profile", "daily_reports", "attendance", "tasks", "dependencies"],
  variables: [{ key: "date", description: "Day to summarize", default: "today" }],
  template: `As my team's manager, summarize the current state of the team using the reports, tasks, attendance and dependencies in <context> for {{date}}.

Provide:
- Overall team status in 2–3 sentences.
- Per-person highlights: what they're focused on and any flags.
- Notable blockers and who they're waiting on.
- Anything that needs my attention today.

Base every statement on the context; note explicitly where data is missing.`,
};

const sprintReview: PromptTemplate = {
  id: "sprint-review",
  title: "Sprint Review",
  audience: "manager",
  description: "Review a sprint: goal, completed vs carried-over, scope changes, risks, actions.",
  surface: "sprints",
  sources: ["profile", "sprints", "tasks", "dependencies"],
  variables: [{ key: "sprint_name", description: "Sprint to review", required: true }],
  template: `Prepare a sprint review for {{sprint_name}} using the sprint, its tasks and related dependencies in <context>.

Include:
- The sprint goal and whether it was met.
- Completed vs. carried-over work (with task refs) and the completion rate.
- Scope changes and notable blockers during the sprint.
- Risks carried into the next sprint.
- 3 concrete recommendations for the next planning session.`,
};

const teamRisks: PromptTemplate = {
  id: "team-risks",
  title: "Team Risks",
  audience: "manager",
  description: "Surface the top team risks from open dependencies, tasks, sprints and reports.",
  surface: "dependencies",
  sources: ["profile", "dependencies", "tasks", "sprints", "daily_reports"],
  variables: [],
  template: `Identify the top risks facing my team using the open dependencies, tasks, sprints and reports in <context>.

For each risk, most severe first:
- What it is, and the evidence in the context.
- Likely impact (delivery, quality, or morale).
- Owner and current state.
- A suggested mitigation and the next step.

Limit to the 5 most important. Do not speculate beyond the context.`,
};

const missingReports: PromptTemplate = {
  id: "missing-reports",
  title: "Missing Reports",
  audience: "manager",
  description: "Find team members missing expected check-in/midday/EOD reports for a day.",
  surface: "reports",
  sources: ["profile", "daily_reports", "attendance"],
  variables: [{ key: "date", description: "Day to check", default: "today" }],
  template: `Determine who on my team has not submitted their expected reports for {{date}} using the daily reports and attendance in <context>.

Output:
- People with a missing check-in, midday, or end-of-day report — state which is missing.
- Anyone marked present in attendance but with no report at all.
- A short, friendly reminder message I can send.

Only flag gaps supported by the context; if attendance or report data is incomplete, say so.`,
};

const workloadAnalysis: PromptTemplate = {
  id: "workload-analysis",
  title: "Workload Analysis",
  audience: "manager",
  description: "Assess workload balance across the team from tasks, time, projects and attendance.",
  surface: "analytics",
  sources: ["profile", "tasks", "time_tracking", "projects", "attendance"],
  variables: [],
  template: `Analyze workload balance across my team using the tasks, time tracking, projects and attendance in <context>.

Provide:
- Who is over-loaded vs. under-utilized, and the signals you used.
- Concentration risks (critical work resting on one person).
- Overdue or at-risk items grouped by assignee.
- Rebalancing suggestions.

Ground every claim in the context and clearly flag low-confidence inferences.`,
};

export const MANAGER_TEMPLATES: PromptTemplate[] = [
  teamSummary,
  sprintReview,
  teamRisks,
  missingReports,
  workloadAnalysis,
];

/**
 * Manager AI features — team-level summaries, blocker/risk detection and
 * workload analysis. Grounding is RLS-scoped by the service layer (a manager
 * sees their team). Template-backed where a Prompt Library entry exists.
 */

import { getPrompt, renderRequest } from "../prompts";
import type { AIFeatureDefinition } from "./types";

const summarizeTeam: AIFeatureDefinition = {
  id: "summarize-team",
  title: "Summarize Team",
  audience: "manager",
  description: "Current team status from reports, tasks, attendance and dependencies.",
  build: (input) => renderRequest(getPrompt("team-summary"), input.variables),
};

const detectBlockers: AIFeatureDefinition = {
  id: "detect-blockers",
  title: "Detect Blockers",
  audience: "manager",
  description: "Surface active blockers affecting the team, most urgent first.",
  build: () => ({
    surface: "dependencies",
    prompt: `From the dependencies, tasks and reports in <context>, detect the active blockers affecting my team. For each blocker, most urgent first:
- What is blocked, and the blocker itself.
- The owner and current state.
- A suggested next step to unblock it.
Only use items present in the context; do not speculate.`,
  }),
};

const sprintSummary: AIFeatureDefinition = {
  id: "sprint-summary",
  title: "Sprint Summary",
  audience: "manager",
  description: "Review a sprint: goal, completed vs carried-over, scope, risks, actions.",
  // Requires a `sprint_name` variable — renderPrompt throws if it's missing.
  build: (input) => renderRequest(getPrompt("sprint-review"), input.variables),
};

const missingReports: AIFeatureDefinition = {
  id: "missing-reports",
  title: "Missing Reports",
  audience: "manager",
  description: "Find team members missing expected check-in/midday/EOD reports.",
  build: (input) => renderRequest(getPrompt("missing-reports"), input.variables),
};

const workloadSuggestions: AIFeatureDefinition = {
  id: "workload-suggestions",
  title: "Workload Suggestions",
  audience: "manager",
  description: "Assess workload balance and suggest rebalancing across the team.",
  build: (input) => renderRequest(getPrompt("workload-analysis"), input.variables),
};

export const MANAGER_FEATURES: AIFeatureDefinition[] = [
  summarizeTeam,
  detectBlockers,
  sprintSummary,
  missingReports,
  workloadSuggestions,
];

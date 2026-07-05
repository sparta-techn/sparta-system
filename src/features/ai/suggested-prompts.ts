/**
 * Suggested prompts shown on the empty state — role-aware starters. These map
 * conceptually to the AI feature/prompt library (`docs/AI_FEATURES.md`) but are
 * plain, ready-to-send chat messages (no template variables required).
 */

import type { SuggestedPrompt } from "./types";

const EMPLOYEE: SuggestedPrompt[] = [
  {
    id: "s-emp-plan",
    title: "Plan my day",
    prompt: "Help me plan my day based on my tasks and yesterday's report.",
  },
  {
    id: "s-emp-tasks",
    title: "Summarize my tasks",
    prompt: "Summarize my open tasks and tell me what to focus on next.",
  },
  {
    id: "s-emp-eod",
    title: "Draft my end-of-day report",
    prompt: "Draft my end-of-day report from today's work.",
  },
  {
    id: "s-emp-blockers",
    title: "What's blocking me?",
    prompt: "What dependencies or blockers should I chase today?",
  },
];

const MANAGER: SuggestedPrompt[] = [
  { id: "s-mgr-team", title: "Summarize my team", prompt: "Summarize my team's status today." },
  { id: "s-mgr-blockers", title: "Detect blockers", prompt: "What is currently blocking my team?" },
  {
    id: "s-mgr-missing",
    title: "Missing reports",
    prompt: "Who on my team is missing their reports today?",
  },
  {
    id: "s-mgr-workload",
    title: "Workload balance",
    prompt: "How is workload balanced across my team, and what should I rebalance?",
  },
];

const OWNER: SuggestedPrompt[] = [
  { id: "s-own-health", title: "Company health", prompt: "Give me a company health check." },
  {
    id: "s-own-exec",
    title: "Executive summary",
    prompt: "Write an executive summary for leadership.",
  },
  { id: "s-own-risk", title: "Top risks", prompt: "What are our top company risks right now?" },
  {
    id: "s-own-weekly",
    title: "Weekly insights",
    prompt: "Give me this week's key insights for leadership.",
  },
];

/** Resolve the audience bucket from a user's roles. */
function audienceFor(roles: string[]): "employee" | "manager" | "owner" {
  if (roles.includes("owner") || roles.includes("admin")) return "owner";
  if (roles.some((r) => ["project_manager", "team_lead", "hr"].includes(r))) return "manager";
  return "employee";
}

/** Suggested prompts appropriate to the user's role. */
export function suggestedPromptsFor(roles: string[]): SuggestedPrompt[] {
  switch (audienceFor(roles)) {
    case "owner":
      return OWNER;
    case "manager":
      return MANAGER;
    default:
      return EMPLOYEE;
  }
}

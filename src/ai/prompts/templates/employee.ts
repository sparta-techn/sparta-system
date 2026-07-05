/**
 * Employee prompt templates — self-service reports and planning grounded in the
 * asking user's own tasks, attendance, reports, time and dependencies.
 */

import type { PromptTemplate } from "../../types";

const morningPlan: PromptTemplate = {
  id: "morning-plan",
  title: "Morning Plan",
  audience: "employee",
  description: "Plan the day from assigned tasks, yesterday's EOD, attendance and open blockers.",
  surface: "global",
  sources: ["profile", "attendance", "daily_reports", "tasks", "dependencies"],
  variables: [{ key: "date", description: "Day to plan for", default: "today" }],
  template: `Using my profile, attendance, yesterday's end-of-day report, my assigned tasks and any open dependencies in <context>, help me plan {{date}}.

Produce:
1. Top 3 priorities for today, most important first — each with its task ref and why it matters.
2. A realistic, ordered task list for the day; flag anything overdue or due today.
3. Blockers or dependencies I should chase, and who owns them.
4. One risk to watch, plus a concrete first action for the next 30 minutes.

Keep it concise and actionable. Only use work that appears in the context.`,
};

const middayReport: PromptTemplate = {
  id: "midday-report",
  title: "Midday Report",
  audience: "employee",
  description: "Draft a midday status update: progress, focus, new blockers, on-track check.",
  surface: "reports",
  sources: ["profile", "daily_reports", "attendance", "tasks", "dependencies"],
  variables: [{ key: "date", description: "Report date", default: "today" }],
  template: `Based on my morning plan, tasks, attendance and progress in <context>, draft my midday status update for {{date}}.

Include:
- Progress so far (rough % and what moved).
- Current focus for the rest of the day.
- Any new blockers or dependencies, with owners.
- Whether I'm on track for my main goal, and what to adjust if not.

Write it in the first person, ready to post. Do not invent progress that isn't in the context.`,
};

const endOfDayReport: PromptTemplate = {
  id: "end-of-day-report",
  title: "End-of-Day Report",
  audience: "employee",
  description: "Draft an EOD report: summary, completed, in-progress, blockers, tomorrow's plan.",
  surface: "reports",
  sources: ["profile", "tasks", "attendance", "time_tracking", "dependencies"],
  variables: [{ key: "date", description: "Report date", default: "today" }],
  template: `Using my tasks, attendance, time tracked and open dependencies in <context>, draft my end-of-day report for {{date}}.

Structure:
- Summary: 2–3 sentences on the day.
- Completed: what I finished (with task refs).
- In progress: what's still open and its current status.
- Blockers / needs from others: with owners.
- Plan for tomorrow: the top items.

Keep it factual and in my voice; do not invent work that isn't in the context.`,
};

const weeklySummary: PromptTemplate = {
  id: "weekly-summary",
  title: "Weekly Summary",
  audience: "employee",
  description: "Summarize the week from daily reports, tasks, time tracking and attendance.",
  surface: "reports",
  sources: ["profile", "daily_reports", "tasks", "time_tracking", "attendance"],
  variables: [
    { key: "week_start", description: "Week start date (YYYY-MM-DD)", required: true },
    { key: "week_end", description: "Week end date (YYYY-MM-DD)", required: true },
  ],
  template: `Summarize my week ({{week_start}} to {{week_end}}) from my daily reports, tasks, time tracking and attendance in <context>.

Cover:
- Key accomplishments, grouped by project where possible.
- Progress against my goals, and any slippage.
- Recurring blockers or dependencies.
- Roughly how my time/effort was distributed.
- My focus and one improvement for next week.

Ground every point in the context; note where data is missing.`,
};

export const EMPLOYEE_TEMPLATES: PromptTemplate[] = [
  morningPlan,
  middayReport,
  endOfDayReport,
  weeklySummary,
];

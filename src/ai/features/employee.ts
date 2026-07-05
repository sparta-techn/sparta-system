/**
 * Employee AI features. Template-backed features reuse the Prompt Library;
 * input-driven ones (improve draft, rewrite) build a grounded prompt inline.
 */

import { getPrompt, renderRequest } from "../prompts";
import type { AIFeatureDefinition } from "./types";
import { fenceText, requireText } from "./feature-utils";

const generateMorningPlan: AIFeatureDefinition = {
  id: "generate-morning-plan",
  title: "Generate Morning Plan",
  audience: "employee",
  description: "Draft today's plan from tasks, yesterday's EOD, attendance and blockers.",
  build: (input) => renderRequest(getPrompt("morning-plan"), input.variables),
};

const improveMiddayReport: AIFeatureDefinition = {
  id: "improve-midday-report",
  title: "Improve Midday Report",
  audience: "employee",
  description: "Tighten and complete a midday report draft using live progress context.",
  build: (input) => {
    const draft = requireText(input, "improve-midday-report");
    return {
      surface: "reports",
      prompt: `Here is my draft midday report:
${fenceText(draft)}

Using my tasks, attendance and progress in <context>, improve it: tighten the wording, fill gaps, and make sure it covers progress, current focus, blockers (with owners) and whether I'm on track. Return only the improved report, in my voice.`,
    };
  },
};

const generateEndOfDayReport: AIFeatureDefinition = {
  id: "generate-end-of-day-report",
  title: "Generate End-of-Day Report",
  audience: "employee",
  description: "Draft an EOD report: summary, completed, in-progress, blockers, tomorrow.",
  build: (input) => renderRequest(getPrompt("end-of-day-report"), input.variables),
};

const rewriteText: AIFeatureDefinition = {
  id: "rewrite-text",
  title: "Rewrite Text",
  audience: "employee",
  description: "Rewrite arbitrary text for clarity and tone (no grounding needed).",
  build: (input) => {
    const text = requireText(input, "rewrite-text");
    const guidance = input.instruction ? ` (${input.instruction})` : "";
    return {
      surface: null,
      prompt: `Rewrite the following text${guidance}. Preserve its meaning; improve clarity, structure and tone. Return only the rewritten text.

${fenceText(text)}`,
    };
  },
};

const summarizeTasks: AIFeatureDefinition = {
  id: "summarize-tasks",
  title: "Summarize Tasks",
  audience: "employee",
  description: "Summarize the user's current tasks with focus recommendations.",
  build: () => ({
    surface: "tasks",
    prompt: `Summarize my current tasks in <context>: group them by status, call out anything overdue or high-priority, and suggest what to focus on next. Be concise and reference task refs. Only use tasks present in the context.`,
  }),
};

export const EMPLOYEE_FEATURES: AIFeatureDefinition[] = [
  generateMorningPlan,
  improveMiddayReport,
  generateEndOfDayReport,
  rewriteText,
  summarizeTasks,
];

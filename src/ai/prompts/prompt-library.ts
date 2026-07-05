/**
 * Prompt Library — a registry of reusable, role-scoped prompt templates plus a
 * deterministic renderer that fills `{{placeholder}}` tokens.
 *
 * A rendered template is the *user message* for a request; pair it with the
 * template's `surface` so the Context Engine grounds it. See `renderRequest`.
 */

import type { PromptAudience, PromptTemplate } from "../types";
import { AIError } from "../utils/errors";
import { EMPLOYEE_TEMPLATES } from "./templates/employee";
import { MANAGER_TEMPLATES } from "./templates/manager";
import { OWNER_TEMPLATES } from "./templates/owner";

/** Every template, in stable declaration order. */
export const ALL_PROMPT_TEMPLATES: PromptTemplate[] = [
  ...EMPLOYEE_TEMPLATES,
  ...MANAGER_TEMPLATES,
  ...OWNER_TEMPLATES,
];

/** Templates indexed by id. */
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = Object.fromEntries(
  ALL_PROMPT_TEMPLATES.map((t) => [t.id, t]),
);

/** Resolve a template by id, or throw when unknown. */
export function getPrompt(id: string): PromptTemplate {
  const template = PROMPT_TEMPLATES[id];
  if (!template) {
    throw new AIError("invalid_request", `Unknown prompt template "${id}".`);
  }
  return template;
}

/** List templates, optionally filtered by audience. */
export function listPrompts(audience?: PromptAudience): PromptTemplate[] {
  if (!audience) return ALL_PROMPT_TEMPLATES;
  return ALL_PROMPT_TEMPLATES.filter((t) => t.audience === audience);
}

/** Replace every `{{token}}` occurrence without regex surprises. */
function fill(body: string, token: string, value: string): string {
  return body.split(`{{${token}}}`).join(value);
}

/**
 * Render a template into a final prompt string. Declared variables are resolved
 * from `values`, then the template's `default`; a missing **required** variable
 * throws. Unresolved optional variables render as empty.
 */
export function renderPrompt(
  template: PromptTemplate,
  values: Record<string, string> = {},
): string {
  let body = template.template;
  for (const variable of template.variables) {
    const provided = values[variable.key];
    const value = provided ?? variable.default;
    if (value === undefined) {
      if (variable.required) {
        throw new AIError(
          "invalid_request",
          `Missing required variable "${variable.key}" for prompt "${template.id}".`,
        );
      }
      body = fill(body, variable.key, "");
    } else {
      body = fill(body, variable.key, value);
    }
  }
  return body.trim();
}

/** Fields ready to hand to `aiEngine.generate()` / `.stream()`. */
export interface RenderedPromptRequest {
  surface: string | null;
  prompt: string;
}

/**
 * Render a template into the `{ surface, prompt }` fields an engine call needs,
 * so callers do not have to remember which surface a template targets.
 */
export function renderRequest(
  template: PromptTemplate,
  values: Record<string, string> = {},
): RenderedPromptRequest {
  return { surface: template.surface, prompt: renderPrompt(template, values) };
}

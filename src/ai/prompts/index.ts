/** Barrel for the prompt layer. */

export { BASE_SYSTEM_PROMPT, SURFACE_PROMPTS, PERSONA_PROMPTS } from "./system-prompts";
export { buildPrompt, buildSystemPrompt, buildMessages, renderContext } from "./prompt-builder";

// Prompt Library — reusable role-scoped templates.
export {
  ALL_PROMPT_TEMPLATES,
  PROMPT_TEMPLATES,
  getPrompt,
  listPrompts,
  renderPrompt,
  renderRequest,
} from "./prompt-library";
export type { RenderedPromptRequest } from "./prompt-library";
export { EMPLOYEE_TEMPLATES, MANAGER_TEMPLATES, OWNER_TEMPLATES } from "./templates";

/**
 * Prompt Builder — deterministic, provider-neutral assembly of the final
 * request. Pure functions: no I/O, no provider knowledge. Takes a
 * {@link PromptInput} and emits a {@link BuiltPrompt} any adapter can send.
 */

import type { AIProviderMessage, BuiltPrompt, ContextBlock, PromptInput } from "../types";
import { BASE_SYSTEM_PROMPT, PERSONA_PROMPTS, SURFACE_PROMPTS } from "./system-prompts";

/**
 * Neutralize the context fence in interpolated data so grounding rows can't break
 * out of `<context>…</context>` and inject instructions (prompt injection). The
 * fence delimiters are the model's only signal that this is data, not commands.
 */
function sanitizeFence(value: string): string {
  return value.replace(/<\/?context>/gi, "");
}

/** Render the context block into a delimited, model-facing section. */
export function renderContext(context: ContextBlock): string {
  if (context.entities.length === 0 && !context.summary) {
    return "<context>No additional context was provided.</context>";
  }

  const lines = context.entities.map((e) => {
    const ref = e.ref ? ` (${sanitizeFence(e.ref)})` : "";
    return `- [${sanitizeFence(e.type)}${ref}] ${sanitizeFence(e.summary)}`;
  });

  const truncatedNote = context.truncated
    ? "\n(Note: context was truncated to fit; some rows were omitted.)"
    : "";

  return ["<context>", sanitizeFence(context.summary), ...lines, truncatedNote, "</context>"]
    .filter(Boolean)
    .join("\n");
}

/** Compose the full system prompt from base + surface + persona + language. */
export function buildSystemPrompt(input: PromptInput): string {
  const parts: string[] = [BASE_SYSTEM_PROMPT];

  const surface = input.surface ? SURFACE_PROMPTS[input.surface] : undefined;
  if (surface) parts.push(surface);

  parts.push(PERSONA_PROMPTS[input.preferences.persona]);
  parts.push(`Respond in language: ${input.preferences.language}.`);
  parts.push(
    `The user is ${input.user.displayName} with roles: ${input.user.roles.join(", ") || "none"}.`,
  );
  parts.push(renderContext(input.context));

  return parts.join("\n\n");
}

/** Assemble the ordered message list: prior history + the new user turn. */
export function buildMessages(input: PromptInput): AIProviderMessage[] {
  return [...input.history, { role: "user", content: input.prompt }];
}

/** Build the complete, provider-ready prompt. */
export function buildPrompt(input: PromptInput): BuiltPrompt {
  return {
    system: buildSystemPrompt(input),
    messages: buildMessages(input),
  };
}

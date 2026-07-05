/**
 * Prompt-assembly contracts. Consumed by the Prompt Builder
 * (`src/ai/prompts/`), which turns a {@link PromptInput} into a neutral
 * {@link BuiltPrompt} any provider adapter can send.
 */

import type { AIProviderMessage } from "./provider";
import type { ContextBlock, ContextSourceKey } from "./context";

/** Minimal caller identity used to personalize and guard the prompt. */
export interface PromptUser {
  id: string;
  displayName: string;
  roles: string[];
}

/** Response-shaping preferences resolved from AI Settings. */
export interface PromptPreferences {
  persona: "concise" | "balanced" | "detailed";
  /** BCP-47 language tag for the reply. */
  language: string;
}

/** Everything the Prompt Builder needs to assemble a request. */
export interface PromptInput {
  /** Feature surface that opened the assistant (`tasks`, `analytics`, …). */
  surface: string | null;
  user: PromptUser;
  /** Authorized grounding data from the Context Builder. */
  context: ContextBlock;
  /** Prior turns (already windowed by the caller when needed). */
  history: AIProviderMessage[];
  /** The new user message. */
  prompt: string;
  preferences: PromptPreferences;
}

/** The neutral, provider-ready output of the Prompt Builder. */
export interface BuiltPrompt {
  system: string;
  messages: AIProviderMessage[];
}

// ── Prompt Library ──────────────────────────────────────────────────────────

/** Who a prompt template is written for. */
export type PromptAudience = "employee" | "manager" | "owner";

/** A `{{placeholder}}` a template expects at render time. */
export interface PromptVariable {
  /** Placeholder key, e.g. `date` → `{{date}}`. */
  key: string;
  /** What the caller should supply. */
  description: string;
  /** When true, rendering fails if no value/default is available. */
  required?: boolean;
  /** Fallback used when the caller omits the value. */
  default?: string;
}

/**
 * A reusable, named prompt template. The rendered `template` becomes the user
 * message sent to the assistant; `surface` + `sources` declare the grounding the
 * Context Engine should gather for it.
 */
export interface PromptTemplate {
  /** Stable kebab-case id, e.g. `morning-plan`. */
  id: string;
  /** Human title, e.g. "Morning Plan". */
  title: string;
  audience: PromptAudience;
  /** One-line purpose. */
  description: string;
  /** Context surface that drives grounding (see `SURFACE_SOURCES`); `null` = global. */
  surface: string | null;
  /** Context sources this prompt relies on (documentation + optional override). */
  sources: ContextSourceKey[];
  /** Declared `{{placeholder}}`s. */
  variables: PromptVariable[];
  /** Template body with `{{placeholder}}` tokens. */
  template: string;
}

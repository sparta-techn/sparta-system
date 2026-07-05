/**
 * AI feature contracts. A "feature" is a named, role-scoped assistant action
 * (Generate Morning Plan, Detect Blockers, Executive Summary, …). Each feature
 * builds an engine request from typed input; the {@link AIAssistantService} runs
 * it through the context engine + prompt builder + provider.
 */

import type { AIFinishReason, AIProviderId, AIUsage, PromptUser } from "../types";

/** Which role a feature is offered to. */
export type AIFeatureAudience = "employee" | "manager" | "owner";

/** Input accepted by every feature (fields are used as each feature needs). */
export interface AIFeatureInput {
  /** The asking user — scopes context and personalizes the prompt. */
  user: PromptUser;
  /** Grounding hints forwarded to the Context Engine (taskId, projectId, workDate…). */
  hints?: Record<string, unknown>;
  /** Values for the prompt template's `{{placeholders}}`. */
  variables?: Record<string, string>;
  /** User-supplied text for input-driven features (rewrite, improve draft). */
  text?: string;
  /** Optional extra instruction (e.g. desired tone for a rewrite). */
  instruction?: string;
}

/** The surface + prompt a feature produces for the engine. */
export interface AIFeatureRequest {
  surface: string | null;
  prompt: string;
}

/** A reusable, named assistant action. */
export interface AIFeatureDefinition {
  /** Stable kebab-case id, e.g. `generate-morning-plan`. */
  id: string;
  /** Human title. */
  title: string;
  audience: AIFeatureAudience;
  /** One-line purpose. */
  description: string;
  /** Build the engine request (surface + prompt) from input. */
  build(input: AIFeatureInput): AIFeatureRequest;
}

/** The result of running a feature. */
export interface AIFeatureResult {
  featureId: string;
  text: string;
  provider: AIProviderId;
  model: string;
  usage: AIUsage;
  finishReason: AIFinishReason;
}

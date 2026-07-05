/**
 * AI provider settings — domain types.
 *
 * Non-secret configuration (provider, model, sampling, system prompt) is stored
 * in the reactive settings store (`store.ts`). **API keys are never part of this
 * shape** — they live in the separate obfuscated secret store (`secure-store.ts`)
 * and are never rendered back to the UI.
 */

import type { AIProviderId } from "@/ai/types";

/** The providers users can configure here. */
export type ConfigurableProviderId = Extract<AIProviderId, "openai" | "anthropic" | "gemini">;

/** Per-provider, non-secret configuration. */
export interface ProviderConfig {
  provider: ConfigurableProviderId;
  /** A model id from the provider's catalog. */
  model: string;
  /** Sampling temperature. */
  temperature: number;
  /** Max output tokens. */
  maxTokens: number;
  /** Optional system prompt override. */
  systemPrompt: string;
}

/** The persisted, non-secret settings state. */
export interface AISettingsState {
  /** Which provider the assistant should use. */
  activeProvider: ConfigurableProviderId;
  configs: Record<ConfigurableProviderId, ProviderConfig>;
}

/** Per-provider secret status surfaced to the UI (never the key itself). */
export interface SecretStatus {
  set: boolean;
  /** Masked preview, e.g. `sk-…a1b2`. Never the full key. */
  preview: string | null;
}

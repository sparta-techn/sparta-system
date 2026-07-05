/**
 * Model catalog — the single source of truth for which models each provider
 * exposes, their limits, and (illustrative) pricing.
 *
 * Costs are placeholders until real integration; they exist so downstream usage
 * tracking can compute estimates from one place. Anthropic is the default
 * provider and ships the current Claude lineup.
 */

import type { AIModelDescriptor, AIProviderId } from "../types";

/** Anthropic (default provider). */
export const ANTHROPIC_MODELS: readonly AIModelDescriptor[] = [
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    inputCostPerMTok: 15,
    outputCostPerMTok: 75,
    tier: "deep",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    inputCostPerMTok: 3,
    outputCostPerMTok: 15,
    tier: "balanced",
    default: true,
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutputTokens: 8_000,
    inputCostPerMTok: 1,
    outputCostPerMTok: 5,
    tier: "fast",
  },
];

/** OpenAI (placeholder). */
export const OPENAI_MODELS: readonly AIModelDescriptor[] = [
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    contextWindow: 128_000,
    maxOutputTokens: 16_000,
    inputCostPerMTok: 5,
    outputCostPerMTok: 15,
    tier: "deep",
    default: true,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    provider: "openai",
    contextWindow: 128_000,
    maxOutputTokens: 16_000,
    inputCostPerMTok: 0.4,
    outputCostPerMTok: 1.6,
    tier: "fast",
  },
];

/** Google Gemini (placeholder). */
export const GEMINI_MODELS: readonly AIModelDescriptor[] = [
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    contextWindow: 1_000_000,
    maxOutputTokens: 8_000,
    inputCostPerMTok: 1.25,
    outputCostPerMTok: 10,
    tier: "deep",
    default: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    contextWindow: 1_000_000,
    maxOutputTokens: 8_000,
    inputCostPerMTok: 0.3,
    outputCostPerMTok: 2.5,
    tier: "fast",
  },
];

/** Mock (offline) — a single zero-cost model so features run without a network. */
export const MOCK_MODELS: readonly AIModelDescriptor[] = [
  {
    id: "mock-1",
    label: "Mock Model (offline)",
    provider: "mock",
    contextWindow: 200_000,
    maxOutputTokens: 4_096,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    tier: "balanced",
    default: true,
  },
];

/** All models keyed by provider. */
export const MODEL_CATALOG: Record<AIProviderId, readonly AIModelDescriptor[]> = {
  anthropic: ANTHROPIC_MODELS,
  openai: OPENAI_MODELS,
  gemini: GEMINI_MODELS,
  local: [],
  mock: MOCK_MODELS,
};

/** Flat list of every catalogued model. */
export const ALL_MODELS: readonly AIModelDescriptor[] = Object.values(MODEL_CATALOG).flat();

/** Look up a model descriptor by id across all providers. */
export function findModel(modelId: string): AIModelDescriptor | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

/** The default model for a provider (its `default` entry, else the first). */
export function defaultModelFor(provider: AIProviderId): AIModelDescriptor | undefined {
  const models = MODEL_CATALOG[provider];
  return models.find((m) => m.default) ?? models[0];
}

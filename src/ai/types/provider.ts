/**
 * The provider contract — the heart of provider-agnosticism.
 *
 * A provider adapter is a thin translator: it maps the neutral
 * {@link AIGenerateParams} onto one vendor's API and normalizes the response
 * ({@link AIGenerateResult}) back to a neutral shape. Nothing above this layer
 * knows which vendor served a request.
 */

import type { AIFinishReason, AIProviderId, AIUsage } from "./common";

/** A single turn passed to a provider (system prompt is carried separately). */
export interface AIProviderMessage {
  role: "user" | "assistant";
  content: string;
}

/** Neutral generation request — no vendor-specific fields. */
export interface AIGenerateParams {
  /** Resolved model id for the chosen provider (e.g. `claude-opus-4-8`). */
  model: string;
  /** System prompt / instructions (assembled by the Prompt Builder). */
  system?: string;
  /** Ordered conversation turns, oldest first. */
  messages: AIProviderMessage[];
  /** Upper bound on generated tokens. */
  maxOutputTokens?: number;
  /** Sampling temperature (0–1 typical). */
  temperature?: number;
  /** Sequences that halt generation. */
  stopSequences?: string[];
  /** Cancellation / timeout signal. */
  signal?: AbortSignal;
}

/** The result of a non-streaming generation. */
export interface AIGenerateResult {
  text: string;
  usage: AIUsage;
  provider: AIProviderId;
  model: string;
  finishReason: AIFinishReason;
}

/** One streamed delta; the terminal chunk carries `usage` + `finishReason`. */
export interface AIStreamChunk {
  delta: string;
  usage?: AIUsage;
  finishReason?: AIFinishReason;
}

/** Parameters accepted by a pre-flight token estimate. */
export interface AITokenCountParams {
  model: string;
  system?: string;
  messages: AIProviderMessage[];
}

/** Static description of a model a provider exposes. */
export interface AIModelDescriptor {
  /** Provider-native model id. */
  id: string;
  /** Human-facing label. */
  label: string;
  /** Which provider serves this model. */
  provider: AIProviderId;
  /** Input token budget. */
  contextWindow: number;
  /** Maximum tokens the model may generate. */
  maxOutputTokens: number;
  /** USD per 1M input tokens (illustrative until wired). */
  inputCostPerMTok: number;
  /** USD per 1M output tokens (illustrative until wired). */
  outputCostPerMTok: number;
  /** Marks this model as the provider's default for the given tier. */
  tier?: "fast" | "balanced" | "deep";
  /** True for the provider's overall default model. */
  default?: boolean;
}

/**
 * The contract every provider adapter implements.
 *
 * Implementations live in `src/ai/providers/`. Callers depend only on this
 * interface, never on a concrete class.
 */
export interface AIProvider {
  /** Stable provider identifier. */
  readonly id: AIProviderId;
  /** Models this provider exposes. */
  readonly models: readonly AIModelDescriptor[];
  /** Whether `stream()` is supported by this provider. */
  readonly supportsStreaming: boolean;

  /** Produce a full completion. */
  generate(params: AIGenerateParams): Promise<AIGenerateResult>;
  /** Produce a completion as a stream of deltas. */
  stream(params: AIGenerateParams): AsyncIterable<AIStreamChunk>;
  /** Estimate the prompt's token cost (heuristic unless the vendor offers one). */
  countTokens(params: AITokenCountParams): Promise<number>;
  /** Look up a model descriptor this provider exposes. */
  getModel(modelId: string): AIModelDescriptor | undefined;
}

/**
 * Abstract provider base.
 *
 * Concrete adapters (`OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`)
 * extend this class and implement only the vendor-specific `generate` / `stream`.
 * Shared behaviour — model lookup, default resolution, the heuristic token count
 * — lives here so no adapter re-implements it.
 */

import type {
  AIGenerateParams,
  AIGenerateResult,
  AIModelDescriptor,
  AIProvider,
  AIProviderId,
  AIStreamChunk,
  AITokenCountParams,
} from "../types";
import { estimatePromptTokens } from "../utils/tokens";
import { AIError } from "../utils/errors";

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly id: AIProviderId;
  abstract readonly models: readonly AIModelDescriptor[];

  /** Providers support streaming unless they opt out. */
  readonly supportsStreaming: boolean = true;

  abstract generate(params: AIGenerateParams): Promise<AIGenerateResult>;
  abstract stream(params: AIGenerateParams): AsyncIterable<AIStreamChunk>;

  /** Look up a model this provider exposes. */
  getModel(modelId: string): AIModelDescriptor | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  /** This provider's default model (its `default` entry, else the first). */
  get defaultModel(): AIModelDescriptor | undefined {
    return this.models.find((m) => m.default) ?? this.models[0];
  }

  /**
   * Heuristic token estimate. Adapters may override with a vendor-accurate
   * tokenizer; the base uses ~4 chars/token so windowing works everywhere.
   */
  async countTokens(params: AITokenCountParams): Promise<number> {
    return estimatePromptTokens(params);
  }

  /**
   * Validate a request before a (future) API call. Shared guardrails so every
   * adapter rejects malformed input identically.
   */
  protected assertValidRequest(params: AIGenerateParams): void {
    if (!params.model) {
      throw new AIError("invalid_request", "A model id is required.");
    }
    if (!this.getModel(params.model)) {
      throw new AIError(
        "unknown_model",
        `Model "${params.model}" is not exposed by provider "${this.id}".`,
      );
    }
    if (params.messages.length === 0) {
      throw new AIError("invalid_request", "At least one message is required.");
    }
  }
}

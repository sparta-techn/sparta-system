/**
 * AIEngine — the orchestration seam that ties the infrastructure together:
 * resolve provider → build context → build prompt → call the model.
 *
 * This is where a completion is coordinated once providers are implemented.
 * Today the call reaches a placeholder adapter and throws
 * `AIError("not_implemented")` — the wiring is complete, the network is not.
 *
 * In production this orchestration runs **server-side** (a Supabase Edge
 * Function) so provider keys never reach the browser; this class is the shared,
 * environment-agnostic core it builds on.
 */

import type {
  AIGenerateResult,
  AIProvider,
  AIProviderId,
  AIStreamChunk,
  ContextRequest,
  PromptPreferences,
  PromptUser,
} from "../types";
import { getProvider } from "../providers/registry";
import { contextBuilder, ContextBuilder } from "../context/context-builder";
import { buildPrompt } from "../prompts/prompt-builder";
import { defaultModelFor } from "../models/catalog";
import { AIError } from "../utils/errors";

/** A high-level completion request handled by the engine. */
export interface EngineRequest {
  user: PromptUser;
  /** New user prompt. */
  prompt: string;
  /** Feature surface (drives context + system prompt). */
  surface?: string | null;
  /** Grounding hints forwarded to the Context Builder. */
  contextHints?: Record<string, unknown>;
  /** Prior conversation turns, oldest first. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Response-shaping preferences. */
  preferences?: Partial<PromptPreferences>;
  /** Override the configured provider. */
  providerId?: AIProviderId;
  /** Override the resolved model id. */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

const DEFAULT_PREFERENCES: PromptPreferences = {
  persona: "balanced",
  language: "en",
};

export class AIEngine {
  constructor(private readonly context: ContextBuilder = contextBuilder) {}

  /** Resolve the provider adapter for a request. */
  private resolveProvider(request: EngineRequest): AIProvider {
    return getProvider(request.providerId);
  }

  /** Resolve the concrete model id, falling back to the provider default. */
  private resolveModel(provider: AIProvider, request: EngineRequest): string {
    if (request.model) return request.model;
    const fallback = defaultModelFor(provider.id);
    if (!fallback) {
      throw new AIError("unknown_model", `Provider "${provider.id}" exposes no models.`);
    }
    return fallback.id;
  }

  /** Shared build steps: context + prompt + resolved provider/model. */
  private async prepare(request: EngineRequest) {
    const provider = this.resolveProvider(request);
    const model = this.resolveModel(provider, request);

    const contextRequest: ContextRequest = {
      surface: request.surface ?? null,
      hints: request.contextHints ?? {},
      userId: request.user.id,
    };
    const context = await this.context.build(contextRequest);

    const built = buildPrompt({
      surface: request.surface ?? null,
      user: request.user,
      context,
      history: request.history ?? [],
      prompt: request.prompt,
      preferences: { ...DEFAULT_PREFERENCES, ...request.preferences },
    });

    return { provider, model, built };
  }

  /** Produce a full completion. */
  async generate(request: EngineRequest): Promise<AIGenerateResult> {
    const { provider, model, built } = await this.prepare(request);
    return provider.generate({
      model,
      system: built.system,
      messages: built.messages,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      signal: request.signal,
    });
  }

  /** Produce a completion as a stream of deltas. */
  async *stream(request: EngineRequest): AsyncGenerator<AIStreamChunk> {
    const { provider, model, built } = await this.prepare(request);
    yield* provider.stream({
      model,
      system: built.system,
      messages: built.messages,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      signal: request.signal,
    });
  }
}

/** Shared engine instance. */
export const aiEngine = new AIEngine();

/**
 * AIAssistantService — the entry point AI features connect to.
 *
 * It resolves a feature by id, builds its grounded request (surface + prompt),
 * and runs it through the {@link AIEngine} (context → prompt → provider). It
 * defaults to the **offline mock provider**, so every feature runs end-to-end
 * with no external API. Point it at a real provider by constructing it with a
 * different `providerId` once an adapter is wired.
 */

import type { AIProviderId, AIStreamChunk, PromptUser } from "../types";
import { AIEngine, aiEngine } from "./ai-engine";
import { getFeature } from "../features/registry";
import type { AIFeatureInput, AIFeatureResult } from "../features/types";

/** A free-form chat turn (as opposed to a named feature). */
export interface ChatInput {
  user: PromptUser;
  /** The new user message. */
  prompt: string;
  /** Optional surface to ground the reply (defaults to global). */
  surface?: string | null;
  /** Grounding hints forwarded to the Context Engine. */
  hints?: Record<string, unknown>;
  /** Prior turns, oldest first. */
  history?: { role: "user" | "assistant"; content: string }[];
}

export class AIAssistantService {
  constructor(
    private readonly engine: AIEngine = aiEngine,
    /** Provider used for every feature. Offline mock by default. */
    private readonly providerId: AIProviderId = "mock",
  ) {}

  /** Run a feature by id and return the completion. */
  async run(featureId: string, input: AIFeatureInput): Promise<AIFeatureResult> {
    const feature = getFeature(featureId);
    const { surface, prompt } = feature.build(input);

    const result = await this.engine.generate({
      user: input.user,
      surface,
      prompt,
      contextHints: input.hints,
      providerId: this.providerId,
    });

    return {
      featureId,
      text: result.text,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      finishReason: result.finishReason,
    };
  }

  /** Run a feature by id and stream the completion as deltas. */
  async *runStream(featureId: string, input: AIFeatureInput): AsyncGenerator<AIStreamChunk> {
    const feature = getFeature(featureId);
    const { surface, prompt } = feature.build(input);

    yield* this.engine.stream({
      user: input.user,
      surface,
      prompt,
      contextHints: input.hints,
      providerId: this.providerId,
    });
  }

  /** Free-form chat turn (non-streaming). */
  async chat(input: ChatInput): Promise<AIFeatureResult> {
    const result = await this.engine.generate({
      user: input.user,
      surface: input.surface ?? null,
      prompt: input.prompt,
      history: input.history,
      contextHints: input.hints,
      providerId: this.providerId,
    });
    return {
      featureId: "chat",
      text: result.text,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      finishReason: result.finishReason,
    };
  }

  /** Free-form chat turn streamed as deltas (the chat UI's default path). */
  async *chatStream(input: ChatInput): AsyncGenerator<AIStreamChunk> {
    yield* this.engine.stream({
      user: input.user,
      surface: input.surface ?? null,
      prompt: input.prompt,
      history: input.history,
      contextHints: input.hints,
      providerId: this.providerId,
    });
  }
}

/** Shared assistant service (offline mock provider). */
export const aiAssistant = new AIAssistantService();

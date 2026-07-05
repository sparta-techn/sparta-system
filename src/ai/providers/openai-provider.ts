/**
 * OpenAIProvider — **placeholder**.
 *
 * No API calls yet. `generate` / `stream` throw `AIError("not_implemented")`.
 * When implemented: prepends `system` as a `role:"system"` message (Chat
 * Completions / Responses API) and reads usage from `usage.prompt_tokens` /
 * `usage.completion_tokens`. The API key must come from a server-side secret
 * (`OPENAI_API_KEY`) — never the browser.
 */

import type {
  AIGenerateParams,
  AIGenerateResult,
  AIModelDescriptor,
  AIProviderId,
  AIStreamChunk,
} from "../types";
import { OPENAI_MODELS } from "../models/catalog";
import { notImplemented } from "../utils/errors";
import { BaseAIProvider } from "./base-provider";

export class OpenAIProvider extends BaseAIProvider {
  readonly id: AIProviderId = "openai";
  readonly models: readonly AIModelDescriptor[] = OPENAI_MODELS;

  async generate(params: AIGenerateParams): Promise<AIGenerateResult> {
    this.assertValidRequest(params);
    // TODO: call OpenAI API server-side and normalize the response.
    return notImplemented("OpenAIProvider.generate");
  }

  // eslint-disable-next-line require-yield
  async *stream(params: AIGenerateParams): AsyncGenerator<AIStreamChunk> {
    this.assertValidRequest(params);
    // TODO: stream OpenAI deltas and normalize to AIStreamChunk.
    return notImplemented("OpenAIProvider.stream");
  }
}

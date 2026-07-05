/**
 * AnthropicProvider — **placeholder**. Default provider once wired.
 *
 * No API calls yet. `generate` / `stream` throw `AIError("not_implemented")`.
 * When implemented: maps `system` → the Messages API top-level `system`,
 * `messages` → `messages[]`, and reads usage from `response.usage`. The API key
 * must come from a server-side secret (`ANTHROPIC_API_KEY`) — never the browser.
 */

import type {
  AIGenerateParams,
  AIGenerateResult,
  AIModelDescriptor,
  AIProviderId,
  AIStreamChunk,
} from "../types";
import { ANTHROPIC_MODELS } from "../models/catalog";
import { notImplemented } from "../utils/errors";
import { BaseAIProvider } from "./base-provider";

export class AnthropicProvider extends BaseAIProvider {
  readonly id: AIProviderId = "anthropic";
  readonly models: readonly AIModelDescriptor[] = ANTHROPIC_MODELS;

  async generate(params: AIGenerateParams): Promise<AIGenerateResult> {
    this.assertValidRequest(params);
    // TODO: call Anthropic Messages API server-side and normalize the response.
    return notImplemented("AnthropicProvider.generate");
  }

  // eslint-disable-next-line require-yield
  async *stream(params: AIGenerateParams): AsyncGenerator<AIStreamChunk> {
    this.assertValidRequest(params);
    // TODO: stream Anthropic message deltas and normalize to AIStreamChunk.
    return notImplemented("AnthropicProvider.stream");
  }
}

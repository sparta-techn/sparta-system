/**
 * GeminiProvider — **placeholder**.
 *
 * No API calls yet. `generate` / `stream` throw `AIError("not_implemented")`.
 * When implemented: maps `system` → `systemInstruction`, role `assistant` →
 * `model`, and reads usage from `usageMetadata`. The API key must come from a
 * server-side secret (`GOOGLE_API_KEY`) — never the browser.
 */

import type {
  AIGenerateParams,
  AIGenerateResult,
  AIModelDescriptor,
  AIProviderId,
  AIStreamChunk,
} from "../types";
import { GEMINI_MODELS } from "../models/catalog";
import { notImplemented } from "../utils/errors";
import { BaseAIProvider } from "./base-provider";

export class GeminiProvider extends BaseAIProvider {
  readonly id: AIProviderId = "gemini";
  readonly models: readonly AIModelDescriptor[] = GEMINI_MODELS;

  async generate(params: AIGenerateParams): Promise<AIGenerateResult> {
    this.assertValidRequest(params);
    // TODO: call Google Gemini API server-side and normalize the response.
    return notImplemented("GeminiProvider.generate");
  }

  // eslint-disable-next-line require-yield
  async *stream(params: AIGenerateParams): AsyncGenerator<AIStreamChunk> {
    this.assertValidRequest(params);
    // TODO: stream Gemini deltas and normalize to AIStreamChunk.
    return notImplemented("GeminiProvider.stream");
  }
}

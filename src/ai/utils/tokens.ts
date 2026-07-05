/**
 * Provider-agnostic token estimation.
 *
 * A deliberately simple heuristic (~4 characters per token) used for prompt
 * windowing and pre-flight cost estimates when a provider does not expose an
 * exact tokenizer. Adapters may override `countTokens` with a vendor-accurate
 * count; everything else can rely on this.
 */

import type { AITokenCountParams, AIUsage } from "../types";

const CHARS_PER_TOKEN = 4;

/** Estimate the token count of a single string. */
export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimate the total prompt tokens for a system + messages payload. */
export function estimatePromptTokens(params: AITokenCountParams): number {
  const system = estimateTextTokens(params.system ?? "");
  const messages = params.messages.reduce((sum, m) => sum + estimateTextTokens(m.content), 0);
  return system + messages;
}

/** Build a normalized {@link AIUsage} from input/output counts. */
export function toUsage(inputTokens: number, outputTokens: number): AIUsage {
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

/** Estimated USD cost for a usage record given per-1M-token rates. */
export function estimateCostUsd(
  usage: AIUsage,
  inputCostPerMTok: number,
  outputCostPerMTok: number,
): number {
  const input = (usage.inputTokens / 1_000_000) * inputCostPerMTok;
  const output = (usage.outputTokens / 1_000_000) * outputCostPerMTok;
  return input + output;
}

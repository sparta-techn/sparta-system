/**
 * MockProvider — an **offline**, deterministic provider. Makes no network calls
 * and needs no API key, so AI features run end-to-end locally. It echoes the
 * request and the grounded context into a clearly-labelled placeholder answer,
 * so output is obviously mock and never mistaken for a real model.
 *
 * This is the provider AI features use by default until a real adapter is wired
 * (see `docs/AI_INFRASTRUCTURE.md`).
 */

import type {
  AIGenerateParams,
  AIGenerateResult,
  AIModelDescriptor,
  AIProviderId,
  AIStreamChunk,
} from "../types";
import { MOCK_MODELS } from "../models/catalog";
import { estimatePromptTokens, estimateTextTokens, toUsage } from "../utils/tokens";
import { BaseAIProvider } from "./base-provider";

/** Pull the rendered `<context>` bullet lines out of a system prompt. */
function extractContextLines(system: string | undefined): string[] {
  if (!system) return [];
  const start = system.indexOf("<context>");
  const end = system.indexOf("</context>");
  if (start === -1 || end === -1 || end < start) return [];
  return system
    .slice(start + "<context>".length, end)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
}

/** Compose the deterministic mock completion for a request. */
export function renderMockCompletion(params: AIGenerateParams): string {
  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  const instruction = (lastUser?.content ?? "").split("\n")[0].trim();
  const contextLines = extractContextLines(params.system);

  const lines: string[] = [
    "[MOCK AI RESPONSE — generated offline by MockProvider; no external model was called]",
    "",
    `Request: ${instruction || "(none)"}`,
    "",
  ];

  if (contextLines.length > 0) {
    lines.push(`Grounded in ${contextLines.length} context item(s):`);
    lines.push(...contextLines.slice(0, 8));
  } else {
    lines.push("No grounding context was provided for this request.");
  }

  lines.push(
    "",
    "Wire a real provider (Anthropic / OpenAI / Gemini) to replace this deterministic placeholder.",
  );
  return lines.join("\n");
}

export class MockProvider extends BaseAIProvider {
  readonly id: AIProviderId = "mock";
  readonly models: readonly AIModelDescriptor[] = MOCK_MODELS;

  async generate(params: AIGenerateParams): Promise<AIGenerateResult> {
    this.assertValidRequest(params);
    const text = renderMockCompletion(params);
    const inputTokens = estimatePromptTokens({
      model: params.model,
      system: params.system,
      messages: params.messages,
    });
    return {
      text,
      usage: toUsage(inputTokens, estimateTextTokens(text)),
      provider: this.id,
      model: params.model,
      finishReason: "stop",
    };
  }

  async *stream(params: AIGenerateParams): AsyncGenerator<AIStreamChunk> {
    const { text, usage } = await this.generate(params);
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      const isLast = i === words.length - 1;
      yield {
        delta: isLast ? words[i] : `${words[i]} `,
        ...(isLast ? { usage, finishReason: "stop" as const } : {}),
      };
    }
  }
}

/**
 * Shared, provider-neutral primitives for the AI infrastructure layer.
 *
 * These types name *concepts*, never a vendor. Every provider adapter maps its
 * own SDK onto these shapes so the rest of the app — prompts, context, services
 * — stays agnostic to which model actually answers.
 */

/**
 * Stable identifier for a supported provider family. `mock` is an offline,
 * deterministic provider used until a real adapter is wired.
 */
export type AIProviderId = "openai" | "anthropic" | "gemini" | "local" | "mock";

/** Conversation roles understood across the layer. */
export type AIRole = "system" | "user" | "assistant";

/** Coarse capability tier requested by callers instead of a raw model id. */
export type AIModelTier = "fast" | "balanced" | "deep";

/** Why a generation stopped, normalized across providers. */
export type AIFinishReason = "stop" | "length" | "content_filter" | "tool_use" | "error";

/** Provider-normalized token accounting for one exchange. */
export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  /** Convenience total; always `inputTokens + outputTokens`. */
  totalTokens: number;
}

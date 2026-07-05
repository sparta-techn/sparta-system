/**
 * AI Assistant — service-layer contracts.
 *
 * No `features/ai` module exists yet, so the assistant's domain shapes live
 * here. They are intentionally provider-agnostic; the backend Edge Function
 * decides which model (Claude) actually serves the request.
 */

export type AiRole = "user" | "assistant" | "system";

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiRole;
  content: string;
  /** Optional structured context the UI attached (entity refs, filters). */
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  userId: string;
  title: string;
  /** Feature surface that opened the assistant (e.g. "tasks", "analytics"). */
  surface: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single prompt sent to the assistant. */
export interface AiCompletionRequest {
  /** Existing conversation to append to; omit to start a new thread. */
  conversationId?: string;
  prompt: string;
  /** Arbitrary grounding context (selected rows, current page, …). */
  context?: Record<string, unknown>;
}

/** The assistant's reply plus the conversation it belongs to. */
export interface AiCompletionResponse {
  conversationId: string;
  message: AiMessage;
}

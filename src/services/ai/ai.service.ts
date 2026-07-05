import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { AiCompletionRequest, AiCompletionResponse, AiConversation, AiMessage } from "./types";

export type AiConversationInsert = Pick<AiConversation, "userId" | "title"> &
  Partial<Pick<AiConversation, "surface">>;
export type AiConversationUpdate = Partial<Pick<AiConversation, "title" | "surface">>;

/**
 * AiService — assistant conversations and completions.
 *
 * Generic CRUD manages `ai_conversations`. The model call itself is delegated to
 * a Supabase Edge Function (`ai-assistant`) so provider keys never reach the
 * browser; the function persists the exchange to `ai_messages` and returns the
 * assistant reply.
 */
export class AiService extends BaseService<
  AiConversation,
  AiConversationInsert,
  AiConversationUpdate
> {
  protected readonly table = "ai_conversations";
  protected readonly entity = "Conversation";
  protected readonly defaultOrderBy = "updatedAt";

  /** A user's conversations, most recently updated first. */
  listForUser(userId: string, params: ListParams<AiConversation> = {}): Promise<AiConversation[]> {
    return this.list({ ...params, filters: { ...params.filters, userId } });
  }

  /** Messages in a conversation, oldest first. */
  async listMessages(conversationId: string): Promise<AiMessage[]> {
    try {
      const { data, error } = await this.client
        .from("ai_messages")
        .select("*")
        .eq("conversationId", conversationId)
        .order("createdAt", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AiMessage[];
    } catch (error) {
      throw toServiceError(error, "Failed to load messages");
    }
  }

  /**
   * Send a prompt to the assistant. Routed through the `ai-assistant` Edge
   * Function, which calls the model server-side and persists the exchange.
   */
  async ask(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    try {
      const { data, error } = await this.client.functions.invoke<AiCompletionResponse>(
        "ai-assistant",
        { body: request },
      );
      if (error) throw error;
      if (!data) throw new Error("Empty assistant response");
      return data;
    } catch (error) {
      throw toServiceError(error, "Assistant request failed");
    }
  }
}

/** Shared singleton — import this, not the class. */
export const aiService = new AiService();

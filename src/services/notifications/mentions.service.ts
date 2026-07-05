import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import type { MentionInsert, MentionRow, MentionSource, MentionUpdate } from "./types";

/**
 * MentionsService — CRUD over the `mentions` table (migration 20260701120000).
 * A mention is created by the comment/task author and read by the mentioned
 * user; RLS scopes reads to the mentioned user or the author.
 */
export class MentionsService extends BaseService<MentionRow, MentionInsert, MentionUpdate> {
  protected readonly table = "mentions";
  protected readonly entity = "Mention";
  protected readonly defaultOrderBy = "created_at";

  /** Mentions of a given user, newest first. */
  listForUser(userId: string, params: ListParams<MentionRow> = {}): Promise<MentionRow[]> {
    return this.list({ ...params, filters: { ...params.filters, mentioned_user_id: userId } });
  }

  /** Unseen mentions of a user (uses `IS NULL`, which `.eq` can't express). */
  async listUnseen(userId: string): Promise<MentionRow[]> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("mentioned_user_id", userId)
        .is("seen_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MentionRow[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /** Mentions attached to a specific source row (e.g. a comment). */
  listForSource(
    sourceType: MentionSource,
    sourceId: string,
    params: ListParams<MentionRow> = {},
  ): Promise<MentionRow[]> {
    return this.list({
      ...params,
      filters: { ...params.filters, source_type: sourceType, source_id: sourceId },
    });
  }

  /** Mark a mention as seen. */
  markSeen(id: string): Promise<MentionRow> {
    return this.update(id, { seen_at: new Date().toISOString() });
  }
}

/** Shared singleton — import this, not the class. */
export const mentionsService = new MentionsService();

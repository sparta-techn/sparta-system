import type { ListParams } from "@/services/core";
import {
  MentionsService,
  mentionsService,
  type MentionInsert,
  type MentionRow,
  type MentionSource,
} from "@/services/notifications";

/**
 * MentionRepository — @-mention operations over the `mentions` table. Feeds the
 * Inbox "Mentions" tab and the mention badge. Delegates to
 * {@link MentionsService}; the author creates a mention, the mentioned user
 * reads and marks it seen (RLS-enforced).
 */
export class MentionRepository {
  constructor(private readonly service: MentionsService = mentionsService) {}

  /** All mentions of a user, newest first. */
  listForUser(userId: string, params: ListParams<MentionRow> = {}): Promise<MentionRow[]> {
    return this.service.listForUser(userId, params);
  }

  /** Unseen mentions of a user (mention badge / inbox). */
  listUnseen(userId: string): Promise<MentionRow[]> {
    return this.service.listUnseen(userId);
  }

  /** Mentions attached to a specific source row (e.g. a comment thread). */
  listForSource(sourceType: MentionSource, sourceId: string): Promise<MentionRow[]> {
    return this.service.listForSource(sourceType, sourceId);
  }

  /** Record a mention (author-side). */
  create(input: MentionInsert): Promise<MentionRow> {
    return this.service.create(input);
  }

  /** Mark a mention as seen. */
  markSeen(id: string): Promise<MentionRow> {
    return this.service.markSeen(id);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const mentionRepository = new MentionRepository();

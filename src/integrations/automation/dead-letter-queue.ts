/**
 * InMemoryDeadLetterQueue — the terminal store for exhausted deliveries.
 *
 * **Placeholder**, per design: capture (`add` / `list` / `purge`) is a working
 * in-memory scaffold so the retry → DLQ pipeline completes end-to-end, but
 * `replay` — re-emitting a dead-lettered delivery through the provider — is
 * `notImplemented`, because it requires the vendor transport that is not wired
 * yet. The whole class is the seam a durable `integration_dead_letters` table
 * (with RLS + Admin replay UI) slots into later.
 */

import { notImplemented } from "../services/errors";
import type { DeadLetterEntry, DeadLetterQueue } from "../ports";

export class InMemoryDeadLetterQueue implements DeadLetterQueue {
  private readonly entries = new Map<string, DeadLetterEntry>();

  async add(entry: DeadLetterEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async list(accountId: string): Promise<readonly DeadLetterEntry[]> {
    return [...this.entries.values()].filter((entry) => entry.accountId === accountId);
  }

  async replay(id: string): Promise<void> {
    // Placeholder: replay must re-dispatch through the (unwired) provider transport.
    return notImplemented(`DeadLetterQueue.replay (${id})`);
  }

  async purge(id: string): Promise<void> {
    this.entries.delete(id);
  }
}

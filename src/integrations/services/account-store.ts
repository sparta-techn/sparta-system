/**
 * AccountStore — the persistence boundary for connected integration accounts.
 *
 * This is the seam that a real Supabase repository slots into later. The
 * interface intentionally mirrors the shape of the future `integration_accounts`
 * table + RLS (see `docs/INTEGRATION_ARCHITECTURE.md` §11). Until the backend
 * lands, {@link InMemoryAccountStore} keeps everything offline and dependency-
 * free, exactly like the feature `store.ts` modules that "mirror the future
 * Supabase repository surface".
 *
 * No external APIs are touched here — this is process-local state only.
 */

import type { IntegrationAccountData, IntegrationId, IntegrationSettings } from "../types";

/** Read/write contract every account persistence backend must satisfy. */
export interface AccountStore {
  get(accountId: string): Promise<IntegrationAccountData | null>;
  listByProvider(integrationId: IntegrationId): Promise<IntegrationAccountData[]>;
  listByOwner(ownerId: string): Promise<IntegrationAccountData[]>;
  save(account: IntegrationAccountData): Promise<IntegrationAccountData>;
  updateSettings(accountId: string, settings: IntegrationSettings): Promise<IntegrationAccountData>;
  setStatus(
    accountId: string,
    status: IntegrationAccountData["status"],
  ): Promise<IntegrationAccountData>;
  remove(accountId: string): Promise<void>;
}

/**
 * Offline, in-memory {@link AccountStore}. Deterministic and side-effect free —
 * safe for tests and for running the UI before the backend exists.
 */
export class InMemoryAccountStore implements AccountStore {
  private readonly accounts = new Map<string, IntegrationAccountData>();

  async get(accountId: string): Promise<IntegrationAccountData | null> {
    return this.accounts.get(accountId) ?? null;
  }

  async listByProvider(integrationId: IntegrationId): Promise<IntegrationAccountData[]> {
    return [...this.accounts.values()].filter((a) => a.integrationId === integrationId);
  }

  async listByOwner(ownerId: string): Promise<IntegrationAccountData[]> {
    return [...this.accounts.values()].filter((a) => a.ownerId === ownerId);
  }

  async save(account: IntegrationAccountData): Promise<IntegrationAccountData> {
    const next = { ...account, updatedAt: new Date().toISOString() };
    this.accounts.set(next.id, next);
    return next;
  }

  async updateSettings(
    accountId: string,
    settings: IntegrationSettings,
  ): Promise<IntegrationAccountData> {
    const current = this.requireAccount(accountId);
    return this.save({ ...current, settings });
  }

  async setStatus(
    accountId: string,
    status: IntegrationAccountData["status"],
  ): Promise<IntegrationAccountData> {
    const current = this.requireAccount(accountId);
    return this.save({ ...current, status });
  }

  async remove(accountId: string): Promise<void> {
    this.accounts.delete(accountId);
  }

  /** Test seam — clear all accounts. */
  clear(): void {
    this.accounts.clear();
  }

  private requireAccount(accountId: string): IntegrationAccountData {
    const current = this.accounts.get(accountId);
    if (!current) {
      throw new Error(`Account "${accountId}" not found`);
    }
    return current;
  }
}

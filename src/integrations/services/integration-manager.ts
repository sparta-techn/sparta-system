/**
 * IntegrationManager — the application-facing facade for the platform.
 *
 * Orchestrates the registry, the account store and the settings manager behind
 * one vendor-blind surface, and maintains a reactive {@link ProviderStatus} per
 * provider. Features never touch adapters directly (per `CLAUDE.md`: "components
 * must never call APIs directly") — they call the manager, and React hooks
 * subscribe to it via `useSyncExternalStore`, matching the reactive store idiom
 * used across the codebase.
 *
 * No external APIs are contacted: connect/sync/health resolve through the
 * offline mock adapter today; placeholder providers report `disabled`.
 */

import { IntegrationAccount, ProviderStatus } from "../models";
import type { PublicIntegrationAccount, ProviderStatusSnapshot } from "../models";
import type { IntegrationRegistry } from "../providers/integration-registry";
import type {
  ConnectInput,
  HealthStatus,
  IntegrationId,
  IntegrationMetadata,
  SyncInput,
  SyncResult,
} from "../types";
import type { AccountStore } from "./account-store";
import { IntegrationError } from "./errors";
import type { SettingsManager } from "./settings-manager";

export class IntegrationManager {
  private readonly statuses = new Map<IntegrationId, ProviderStatus>();
  private readonly listeners = new Set<() => void>();
  private snapshotCache: ProviderStatusSnapshot[] | null = null;

  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly store: AccountStore,
    readonly settings: SettingsManager,
  ) {
    // Seed each provider's initial status from its static metadata.
    for (const meta of this.registry.catalog()) {
      this.statuses.set(
        meta.id,
        meta.available
          ? ProviderStatus.disconnected(meta.id)
          : ProviderStatus.disabled(meta.id, "Not available yet."),
      );
    }
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  /** Static metadata for every registered provider. */
  catalog(): IntegrationMetadata[] {
    return this.registry.catalog();
  }

  /** Current status for one provider. */
  getStatus(id: IntegrationId): ProviderStatus {
    return this.statuses.get(id) ?? ProviderStatus.disconnected(id);
  }

  /** All accounts owned by a given user/org. */
  async listAccounts(ownerId: string): Promise<PublicIntegrationAccount[]> {
    const accounts = await this.store.listByOwner(ownerId);
    return accounts.map(IntegrationAccount.toPublic);
  }

  // ── Lifecycle (vendor-blind) ────────────────────────────────────────────────

  async connect(id: IntegrationId, input: ConnectInput): Promise<PublicIntegrationAccount> {
    this.assertAvailable(id);
    const account = await this.registry.get(id).connect(input);
    await this.refreshStatus(id);
    return IntegrationAccount.toPublic(account);
  }

  async disconnect(accountId: string): Promise<void> {
    const account = await this.requireAccount(accountId);
    await this.registry.get(account.integrationId).disconnect(accountId);
    await this.refreshStatus(account.integrationId);
  }

  async sync(input: SyncInput): Promise<SyncResult> {
    const account = await this.requireAccount(input.accountId);
    this.assertAvailable(account.integrationId);
    const result = await this.registry.get(account.integrationId).sync(input);
    await this.refreshStatus(account.integrationId);
    return result;
  }

  async healthCheck(accountId: string): Promise<HealthStatus> {
    const account = await this.requireAccount(accountId);
    return this.registry.get(account.integrationId).healthCheck(accountId);
  }

  // ── Status refresh ──────────────────────────────────────────────────────────

  /** Recompute and publish the status for one provider. */
  async refreshStatus(id: IntegrationId): Promise<ProviderStatus> {
    const meta = this.registry.catalog().find((m) => m.id === id);
    let status: ProviderStatus;

    if (!meta?.available) {
      status = ProviderStatus.disabled(id, "Not available yet.");
    } else {
      const active = (await this.store.listByProvider(id)).filter((a) => a.status === "active");
      if (active.length === 0) {
        status = ProviderStatus.disconnected(id);
      } else {
        const health = await this.registry.get(id).healthCheck(active[0].id);
        status = ProviderStatus.fromHealth(id, active.length, health);
      }
    }

    this.statuses.set(id, status);
    this.publish();
    return status;
  }

  /** Recompute every provider's status (e.g. on Admin page load). */
  async refreshAll(): Promise<void> {
    await Promise.all(this.registry.ids().map((id) => this.refreshStatus(id)));
  }

  // ── Reactive store surface (for useSyncExternalStore) ───────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Stable snapshot array; identity changes only when a status changes. */
  getSnapshot = (): ProviderStatusSnapshot[] => {
    if (!this.snapshotCache) {
      this.snapshotCache = this.registry.ids().map((id) => this.getStatus(id).toSnapshot());
    }
    return this.snapshotCache;
  };

  // ── Internals ────────────────────────────────────────────────────────────────

  private publish(): void {
    this.snapshotCache = null; // invalidate; rebuilt lazily on next read
    this.listeners.forEach((l) => l());
  }

  private assertAvailable(id: IntegrationId): void {
    const meta = this.registry.catalog().find((m) => m.id === id);
    if (!meta) {
      throw new IntegrationError("unknown_provider", `No provider "${id}".`);
    }
    if (!meta.available) {
      throw new IntegrationError(
        "not_implemented",
        `${meta.displayName} is not available yet (no external API wired).`,
      );
    }
  }

  private async requireAccount(accountId: string) {
    const account = await this.store.get(accountId);
    if (!account) {
      throw new IntegrationError("not_connected", `Account "${accountId}" was not found.`);
    }
    return account;
  }
}

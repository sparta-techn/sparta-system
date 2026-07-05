/**
 * useIntegrations — the primary hook for integration UI.
 *
 * Subscribes to the shared {@link IntegrationManager} via `useSyncExternalStore`
 * (the reactive-store idiom used across the codebase) and merges each provider's
 * static metadata with its live status. Also exposes vendor-blind action
 * callbacks so components never import an adapter or the manager directly.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { ProviderStatusSnapshot } from "../models";
import type { ConnectInput, IntegrationId, IntegrationMetadata, SyncInput } from "../types";
import { getIntegrationManager } from "../services/container";

/** A provider row for the UI: what it is + how it's doing right now. */
export interface IntegrationView {
  metadata: IntegrationMetadata;
  status: ProviderStatusSnapshot;
}

export interface UseIntegrations {
  integrations: IntegrationView[];
  connect: (id: IntegrationId, input: ConnectInput) => Promise<void>;
  disconnect: (accountId: string) => Promise<void>;
  sync: (input: SyncInput) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useIntegrations(): UseIntegrations {
  const manager = getIntegrationManager();

  const snapshots = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );

  const integrations = useMemo<IntegrationView[]>(() => {
    const byId = new Map(snapshots.map((s) => [s.integrationId, s]));
    return manager.catalog().map((metadata) => ({
      metadata,
      status: byId.get(metadata.id) ?? {
        integrationId: metadata.id,
        state: "disconnected",
        connected: false,
        accountCount: 0,
        lastCheckedAt: null,
        latencyMs: null,
        message: null,
      },
    }));
  }, [manager, snapshots]);

  const connect = useCallback(
    async (id: IntegrationId, input: ConnectInput) => {
      await manager.connect(id, input);
    },
    [manager],
  );

  const disconnect = useCallback(
    async (accountId: string) => {
      await manager.disconnect(accountId);
    },
    [manager],
  );

  const sync = useCallback(
    async (input: SyncInput) => {
      await manager.sync(input);
    },
    [manager],
  );

  const refresh = useCallback(async () => {
    await manager.refreshAll();
  }, [manager]);

  return { integrations, connect, disconnect, sync, refresh };
}

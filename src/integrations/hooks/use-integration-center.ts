/**
 * useIntegrationCenter — the reactive view model for the Integration Center.
 *
 * Merges each provider's static metadata (from the {@link IntegrationManager}
 * catalog) with its live telemetry from the offline {@link MockTelemetryService},
 * subscribed via `useSyncExternalStore` (the codebase's reactive-store idiom).
 * Exposes local mock actions so the UI feels wired without any API call.
 *
 * When the real telemetry backend lands, only this hook's data source changes —
 * the components stay the same.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { IntegrationId, IntegrationMetadata } from "../types";
import type { IntegrationTelemetry } from "../services/mock-telemetry";
import { getIntegrationManager, getTelemetryService } from "../services/container";

/** One Integration Center row: what the provider is + how it's doing now. */
export interface IntegrationCenterRow {
  metadata: IntegrationMetadata;
  telemetry: IntegrationTelemetry;
}

export interface UseIntegrationCenter {
  rows: IntegrationCenterRow[];
  connect: (id: IntegrationId) => void;
  disconnect: (id: IntegrationId) => void;
  sync: (id: IntegrationId) => void;
  refresh: (id: IntegrationId) => void;
  refreshAll: () => void;
}

export function useIntegrationCenter(): UseIntegrationCenter {
  const manager = getIntegrationManager();
  const telemetry = getTelemetryService();

  const snapshots = useSyncExternalStore(
    telemetry.subscribe,
    telemetry.getSnapshot,
    telemetry.getSnapshot,
  );

  const rows = useMemo<IntegrationCenterRow[]>(() => {
    const byId = new Map(snapshots.map((t) => [t.integrationId, t]));
    return manager.catalog().map((metadata) => ({
      metadata,
      telemetry: byId.get(metadata.id) ?? telemetry.get(metadata.id),
    }));
  }, [manager, telemetry, snapshots]);

  const connect = useCallback((id: IntegrationId) => telemetry.connect(id), [telemetry]);
  const disconnect = useCallback((id: IntegrationId) => telemetry.disconnect(id), [telemetry]);
  const sync = useCallback((id: IntegrationId) => telemetry.sync(id), [telemetry]);
  const refresh = useCallback((id: IntegrationId) => telemetry.refresh(id), [telemetry]);
  const refreshAll = useCallback(() => telemetry.refreshAll(), [telemetry]);

  return { rows, connect, disconnect, sync, refresh, refreshAll };
}

/** Single-provider telemetry view, built on the same reactive subscription. */
export function useIntegrationTelemetry(id: IntegrationId): IntegrationCenterRow | undefined {
  const { rows } = useIntegrationCenter();
  return useMemo(() => rows.find((r) => r.metadata.id === id), [rows, id]);
}

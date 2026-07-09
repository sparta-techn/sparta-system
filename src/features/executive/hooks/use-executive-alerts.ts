/**
 * useExecutiveAlerts — runs the Executive Alert Engine and exposes the store's
 * lifecycle surface to the UI.
 *
 * On mount (and on `refresh`) it evaluates the engine over the supplied input
 * and reconciles the results into the reactive store. Dismiss / archive /
 * restore proxy the store mutations; active/dismissed/archived/history are live
 * store selections.
 */
import { useCallback, useEffect, useMemo } from "react";
import { executiveAlertEngine, type AlertEngineInput } from "@/services/alerts";
import {
  archiveAlert,
  clearArchived,
  dismissAlert,
  filterAlertsByState,
  restoreAlert,
  selectAlerts,
  selectHistory,
  sync,
  useAlertsState,
  type AlertEvent,
  type StoredAlert,
} from "../alerts/alert-store";

export interface UseExecutiveAlerts {
  active: StoredAlert[];
  dismissed: StoredAlert[];
  archived: StoredAlert[];
  history: AlertEvent[];
  /** Re-evaluate the engine and reconcile into the store. */
  refresh: () => void;
  dismiss: (id: string) => void;
  archive: (id: string) => void;
  restore: (id: string) => void;
  clearArchived: () => void;
}

export function useExecutiveAlerts(input: AlertEngineInput): UseExecutiveAlerts {
  // Subscribe to the stable `alerts` record; derive the per-state lists in a
  // memo so `getSnapshot` never returns a freshly-allocated array (which would
  // trip useSyncExternalStore's infinite-loop guard).
  const alerts = useAlertsState(selectAlerts);
  const history = useAlertsState(selectHistory);

  const active = useMemo(() => filterAlertsByState(alerts, "active"), [alerts]);
  const dismissed = useMemo(() => filterAlertsByState(alerts, "dismissed"), [alerts]);
  const archived = useMemo(() => filterAlertsByState(alerts, "archived"), [alerts]);

  const refresh = useCallback(() => {
    sync(executiveAlertEngine.evaluate(input));
  }, [input]);

  // Evaluate once on mount; the store keeps lifecycle across refreshes.
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    active,
    dismissed,
    archived,
    history,
    refresh,
    dismiss: dismissAlert,
    archive: archiveAlert,
    restore: restoreAlert,
    clearArchived,
  };
}

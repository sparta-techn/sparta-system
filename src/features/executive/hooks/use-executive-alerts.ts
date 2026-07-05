/**
 * useExecutiveAlerts — runs the Executive Alert Engine and exposes the store's
 * lifecycle surface to the UI.
 *
 * On mount (and on `refresh`) it evaluates the engine over the supplied input
 * and reconciles the results into the reactive store. Dismiss / archive /
 * restore proxy the store mutations; active/dismissed/archived/history are live
 * store selections.
 */
import { useCallback, useEffect } from "react";
import { executiveAlertEngine, type AlertEngineInput } from "@/services/alerts";
import {
  archiveAlert,
  clearArchived,
  dismissAlert,
  restoreAlert,
  selectActive,
  selectArchived,
  selectDismissed,
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
  const active = useAlertsState(selectActive);
  const dismissed = useAlertsState(selectDismissed);
  const archived = useAlertsState(selectArchived);
  const history = useAlertsState(selectHistory);

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

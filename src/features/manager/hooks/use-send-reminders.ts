import { useState } from "react";
import { toast } from "sonner";

import { sendMissingReportRemindersFn } from "../reminders.functions";

/**
 * Shared "Send reminder" behavior for the manager dashboard. Fires the on-demand
 * missing-report reminder fan-out (see `reminders.functions.ts`) and surfaces a
 * toast, tracking a pending flag so callers can disable their trigger while the
 * request is in flight. Reused by both the dashboard header and the Quick
 * Actions card so the behavior stays in one place.
 */
export function useSendReminders() {
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      await sendMissingReportRemindersFn();
      toast.success("Reminders sent to teammates with a missing report today.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reminders.");
    } finally {
      setSending(false);
    }
  };

  return { send, sending };
}

/**
 * Bootstraps the notification subsystem once on the client. Imported by
 * the root client component so the engine is wired before any module
 * publishes events.
 *
 * Data comes from Supabase (see `store.ts`): we bind the store to the signed-in
 * user and keep it in step with auth, instead of seeding mock notifications.
 */

import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

import { startAutomationEngine } from "./automation-engine";
import { setPreferencesUser } from "./preferences";
import { setNotificationUser } from "./store";

let bootstrapped = false;

export function bootstrapNotifications() {
  if (bootstrapped) return;
  bootstrapped = true;
  startAutomationEngine();

  // Bind the notification store + preferences to the authenticated user and keep
  // them fresh across sign-in/out.
  void supabase.auth.getUser().then(({ data }) => {
    const userId = data.user?.id ?? null;
    setNotificationUser(userId);
    setPreferencesUser(userId);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user?.id ?? null;
    setNotificationUser(userId);
    setPreferencesUser(userId);
  });
}

export function useNotificationBootstrap() {
  useEffect(() => {
    bootstrapNotifications();
  }, []);
}

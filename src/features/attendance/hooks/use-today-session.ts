import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { attendanceKeys, todaySessionQuery } from "../queries";

/**
 * Today's work session for the given user, with realtime subscription that
 * invalidates the query whenever the session or any of its breaks changes.
 */
export function useTodaySession(userId: string | null) {
  const qc = useQueryClient();
  const query = useQuery(todaySessionQuery(userId ?? ""));

  useEffect(() => {
    if (!userId) return;
    // Unique topic per mount: supabase-js returns the SAME channel object for a
    // reused topic name, so under React StrictMode's mount→unmount→mount the
    // second mount would grab the first (already-subscribed) channel whose async
    // removeChannel hasn't finished, then `.on()` throws "cannot add
    // postgres_changes callbacks after subscribe()". A per-mount nonce avoids it.
    const channel = supabase
      .channel(`attendance:self:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_sessions", filter: `user_id=eq.${userId}` },
        () => {
          void qc.invalidateQueries({ queryKey: attendanceKeys.today(userId) });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_session_breaks", filter: `user_id=eq.${userId}` },
        () => {
          void qc.invalidateQueries({ queryKey: attendanceKeys.today(userId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}

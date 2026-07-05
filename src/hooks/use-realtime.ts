/**
 * useRealtimeSubscription — React binding for Supabase Realtime.
 *
 * Wraps {@link subscribeToTable} in an effect so the channel is torn down
 * automatically when the component unmounts (page disposal) or when the scoped
 * channel changes. Callbacks are held in a ref so re-renders don't churn the
 * subscription — it only re-subscribes when the `(table, event, filter,
 * enabled)` identity changes.
 *
 * Pass `null` (or `enabled: false`) to subscribe to nothing — the idiom for
 * "only subscribe once we know the scope" (e.g. the signed-in user id), which
 * keeps the client on the minimum set of relevant channels.
 */
import * as React from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  isRealtimeEnabled,
  subscribeToTable,
  type RealtimeStatus,
  type TableSubscription,
} from "@/lib/supabase/realtime";

export type { RealtimeStatus } from "@/lib/supabase/realtime";

export interface RealtimeSubscription<
  Row extends Record<string, unknown>,
> extends TableSubscription<Row> {
  /** Set false to disable without changing call order. Defaults to true. */
  enabled?: boolean;
}

export function useRealtimeSubscription<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(sub: RealtimeSubscription<Row> | null): void {
  // Latest callbacks/config without forcing a re-subscribe each render.
  const ref = React.useRef(sub);
  ref.current = sub;

  const enabled = !!sub && sub.enabled !== false && !!sub.table;
  const table = sub?.table ?? "";
  const event = sub?.event ?? "*";
  const filter = sub?.filter ?? "";
  const schema = sub?.schema ?? "public";

  React.useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeToTable<Row>({
      table,
      schema,
      event: event as TableSubscription<Row>["event"],
      filter: filter || undefined,
      onChange: (payload: RealtimePostgresChangesPayload<Row>) => ref.current?.onChange(payload),
      onResync: () => ref.current?.onResync?.(),
      onStatus: (status: RealtimeStatus) => ref.current?.onStatus?.(status),
    });
    return unsubscribe; // auto-unsubscribe on unmount / dependency change
  }, [enabled, table, schema, event, filter]);
}

/** True when a table is in the realtime publication (else the hook is dormant). */
export const realtimeEnabled = isRealtimeEnabled;

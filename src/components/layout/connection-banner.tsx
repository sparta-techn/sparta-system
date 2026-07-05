/**
 * ConnectionBanner — ambient, non-blocking connectivity indicator.
 *
 * Renders a thin fixed banner only while the browser reports offline. It does
 * not gate the UI (cached data stays usable) and disappears automatically on
 * reconnect. On reconnect, TanStack Query refetches stale data and the Realtime
 * manager resyncs dropped channels (see `lib/supabase/realtime.ts`), so no
 * manual action is required — the banner is purely informational.
 */
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function ConnectionBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-xs font-medium text-warning-foreground shadow-sm"
    >
      <WifiOff className="size-3.5" aria-hidden />
      <span>You're offline. Some data may be out of date — we'll reconnect automatically.</span>
    </div>
  );
}

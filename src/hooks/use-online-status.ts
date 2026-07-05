/**
 * useOnlineStatus — reactive browser connectivity.
 *
 * Subscribes to the window `online`/`offline` events via `useSyncExternalStore`
 * so components re-render when connectivity changes. SSR-safe: reports `true`
 * on the server (assume online until the client proves otherwise), which also
 * avoids a hydration flash.
 *
 * Note: `navigator.onLine === true` only means "has a network interface", not
 * "can reach our API". Genuine request failures are still classified as
 * `network` by `@/lib/errors` and drive TanStack Query's retry/backoff. This
 * hook powers the *ambient* offline banner, not per-request handling.
 */
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/** Server always reports online to avoid a false "offline" flash on hydration. */
function getServerSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

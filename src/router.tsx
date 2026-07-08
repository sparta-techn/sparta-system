import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import {
  getErrorMessage,
  isSessionExpired,
  reportError,
  retryDelay,
  shouldRetry,
} from "@/lib/errors";

/**
 * Fix B — recover invites emailed *before* invite links were targeted at the
 * set-password page. Such links land on the project's Site URL (typically `/`
 * or `/app`) carrying the token in the hash (`#access_token=…&type=invite`).
 * Nothing on the root/dashboard flow routes that token to the set-password
 * screen, so the invitee bounces to sign-in and never sets a password.
 *
 * Runs synchronously at client-entry module load — BEFORE the Supabase client
 * is first accessed and its `detectSessionInUrl` consumes and strips the hash —
 * and forwards the whole token-bearing hash to `/auth/accept-invitation`, where
 * the (guard-less) accept flow exchanges it. New invites land there directly
 * (Fix A) and short-circuit on the `pathname` check below.
 */
function forwardInviteTokenLanding(): void {
  if (typeof window === "undefined") return;
  const { hash, pathname } = window.location;
  if (!hash || hash.length < 2) return;

  const params = new URLSearchParams(hash.slice(1));
  // Implicit-flow auth landings carry the token in the hash; anchor links don't.
  if (!params.get("access_token") || params.get("type") !== "invite") return;

  const target = "/auth/accept-invitation";
  if (pathname === target) return; // already there — let the page handle it

  // Preserve the token-bearing hash across the hop.
  window.location.replace(`${target}${hash}`);
}

forwardInviteTokenLanding();

/**
 * Route to the session-expired screen exactly once when a request fails auth.
 * A module-level flag prevents a redirect storm when several in-flight queries
 * all 401 at the same moment. Skipped on the server and on the auth pages
 * themselves (so we never loop).
 */
let redirectingForAuth = false;
function handleSessionExpiry(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isSessionExpired(error)) return false;
  if (redirectingForAuth) return true;
  if (window.location.pathname.startsWith("/auth")) return true;
  redirectingForAuth = true;
  window.location.assign("/auth/session-expired");
  return true;
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    // Global read failures. Consumers still render their own inline ErrorState
    // via `useQuery().error`; here we only (a) report, (b) redirect on session
    // expiry, and (c) toast when a *background* refetch fails while stale data
    // is still on screen (the only case with no inline error surface).
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, { source: "query", queryKey: query.queryKey });
        if (handleSessionExpiry(error)) return;
        if (query.state.data !== undefined && query.meta?.suppressGlobalError !== true) {
          toast.error(getErrorMessage(error));
        }
      },
    }),
    // Global write failures. Mutations rarely render inline errors, so surface a
    // friendly toast by default (opt out with `meta.suppressGlobalError`).
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        reportError(error, { source: "mutation" });
        if (handleSessionExpiry(error)) return;
        if (mutation.meta?.suppressGlobalError !== true) {
          toast.error(getErrorMessage(error));
        }
      },
    }),
    defaultOptions: {
      queries: {
        // Treat data as fresh for 60s to avoid redundant refetches on mount /
        // navigation. Feature hooks that need tighter freshness override this
        // per-query (see features/attendance/queries.ts).
        staleTime: 60_000,
        // Keep unused data cached for 5 min so revisiting a screen is instant.
        gcTime: 5 * 60_000,
        // Background tab focus should not trigger a refetch storm.
        refetchOnWindowFocus: false,
        // Retry only transient failures (network / 5xx) with backoff; fail fast
        // on auth/permission/not-found/validation. See @/lib/errors.
        retry: shouldRetry,
        retryDelay,
      },
      mutations: {
        // Never auto-retry writes — a retried mutation can double-apply.
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code + loaders on hover/focus for instant navigation.
    defaultPreload: "intent",
    // Debounce intent preloads so hovering a nav list doesn't over-fetch.
    defaultPreloadDelay: 100,
    // Reuse preloaded route data for 30s instead of re-running loaders.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};

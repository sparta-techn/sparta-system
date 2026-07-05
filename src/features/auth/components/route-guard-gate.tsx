import { type ReactNode } from "react";
import { Navigate, useMatches } from "@tanstack/react-router";

import { LoadingState } from "@/components/states";
import { useAuth } from "../auth-context";
import { evaluateAccess, mergeGuards } from "../route-guard";

/**
 * Enforces the declared route guards for everything under the `_authenticated`
 * layout. Reads each matched route's `staticData.guard`, merges the chain into
 * one effective policy, and evaluates it against the live identity from
 * `useAuth()`.
 *
 * Redirect targets (see `docs/ROUTE_GUARDS.md`):
 *   - identity still loading → transient loading state (no flash of denial)
 *   - session lost in-page   → `/auth/session-expired` (Session Expired)
 *   - role/permission denied → `/unauthorized` (Forbidden page)
 *
 * Not-signed-in at navigation time is already handled upstream by the layout's
 * `beforeLoad` redirect to `/auth` (the Unauthorized destination).
 */
export function RouteGuardGate({ children }: { children: ReactNode }) {
  const matches = useMatches();
  const auth = useAuth();

  // Wait for identity so we neither flash a page nor a false denial.
  if (!auth.initialized || auth.loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingState label="Checking access" />
      </div>
    );
  }

  const guard = mergeGuards(matches.map((m) => m.staticData?.guard));
  const result = evaluateAccess(guard, auth);

  // The layout guaranteed auth on entry; losing it in-page means the session
  // dropped — treat as expiry rather than a fresh sign-in prompt.
  if (result === "unauthenticated") {
    return <Navigate to="/auth/session-expired" replace />;
  }
  if (result === "forbidden") {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

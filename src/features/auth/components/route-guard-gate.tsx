import { type ReactNode } from "react";
import { Navigate, useMatches, useRouterState } from "@tanstack/react-router";

import { LoadingState } from "@/components/states";
import { FuturePlanPlaceholder } from "@/components/future-plan";
import { isPathInMvp } from "@/config/mvp-scope";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  // Product-scope gate: features deferred past the MVP render a placeholder for
  // anyone who reaches the URL directly. Evaluated after RBAC so scope never
  // masks a genuine permission redirect. Underlying feature code is untouched
  // — see src/config/mvp-scope.ts.
  if (!isPathInMvp(pathname)) {
    return <FuturePlanPlaceholder />;
  }

  return <>{children}</>;
}

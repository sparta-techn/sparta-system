import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { RouteGuardGate } from "@/features/auth/components/route-guard-gate";

/**
 * Pathless protected layout. Any route placed under `src/routes/_authenticated/`
 * is gated by this. SSR is disabled because the Supabase session lives in
 * `localStorage`, which the server cannot read.
 *
 * Two layers of enforcement:
 *   1. `beforeLoad` — **Authentication Required**. No session → `/auth`
 *      (Unauthorized); a present-but-invalid session → `/auth/session-expired`.
 *   2. `<RouteGuardGate>` — **Required Role / Required Permissions**, evaluated
 *      from each route's declared `staticData.guard`. See `docs/ROUTE_GUARDS.md`.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  staticData: { guard: { authRequired: true } },
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Distinguish "signed out" from "session expired": a stored-but-invalid
      // session (getUser failed while getSession still has one) is an expiry.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        throw redirect({ to: "/auth/session-expired" });
      }
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <RouteGuardGate>
      <Outlet />
    </RouteGuardGate>
  );
}

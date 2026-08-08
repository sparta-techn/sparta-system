import { createFileRoute } from "@tanstack/react-router";

import { routeGuard } from "@/features/auth/route-guard";
import { RewardsPanel } from "@/features/rewards/components/rewards-panel";

export const Route = createFileRoute("/_authenticated/app/hr/rewards")({
  // Rewards are Owner/Admin only; RLS on `rewards` is the backstop. Also gated
  // by mvp-scope (`hr-rewards`) via <RouteGuardGate> like every route.
  staticData: routeGuard({ roles: ["owner", "admin"] }),
  head: () => ({
    meta: [{ title: "Rewards · SpartaFlow Hub" }],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  return <RewardsPanel />;
}

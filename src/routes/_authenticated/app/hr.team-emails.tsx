import { createFileRoute } from "@tanstack/react-router";

import { routeGuard } from "@/features/auth/route-guard";
import { BroadcastPanel } from "@/features/general-emails/components/broadcast-panel";

export const Route = createFileRoute("/_authenticated/app/hr/team-emails")({
  // Team emails are Owner/Admin only; RLS on `general_emails` and
  // `general_email_deliveries` is the backstop. Also gated by mvp-scope
  // (`hr-team-emails`) via <RouteGuardGate> like every route.
  staticData: routeGuard({ roles: ["owner", "admin"] }),
  head: () => ({
    meta: [{ title: "Team emails · SpartaFlow Hub" }],
  }),
  component: TeamEmailsPage,
});

function TeamEmailsPage() {
  return <BroadcastPanel />;
}

import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { routeGuard } from "@/features/auth/route-guard";
import { ExecutiveDashboard } from "@/features/executive/executive-dashboard";

export const Route = createFileRoute("/_authenticated/app/executive")({
  // The executive cockpit is owner-scoped (mirror of RLS intent, ARCHITECTURE §12).
  // Enforced declaratively by <RouteGuardGate> — no in-component guard needed.
  staticData: routeGuard({ permissions: ["dashboard.executive.view"] }),
  head: () => ({ meta: [{ title: "Executive Dashboard · SpartaFlow Hub" }] }),
  component: ExecutiveDashboardPage,
});

function ExecutiveDashboardPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Leadership"
        title="Executive dashboard"
        description="The company at a glance — health, delivery, people, and the risks that need your attention."
        actions={<Button variant="outline">Export</Button>}
      />
      <ExecutiveDashboard />
    </AppShell>
  );
}

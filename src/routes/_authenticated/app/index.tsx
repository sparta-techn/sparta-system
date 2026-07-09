import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { PersonalDashboard } from "@/features/dashboard/components/personal-dashboard";
import { ExecutiveDashboard } from "@/features/executive/executive-dashboard";
import { ManagerDashboard } from "@/features/manager/manager-dashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [{ title: "Dashboard · SpartaFlow Hub" }],
  }),
  component: DashboardPage,
});

/**
 * Root dashboard — renders the variant that matches the signed-in user's role
 * (B5 dashboard wiring). Owner/Admin get the company-wide cockpit; team leaders
 * get the operational manager view; everyone else gets the personal, check-in
 * focused dashboard. Route-level RBAC still guards the deeper /app/executive and
 * /app/manager pages; this only picks the sensible landing view.
 */
function DashboardPage() {
  const { hasAnyRole } = useAuth();

  if (hasAnyRole(["owner", "admin"])) {
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

  if (hasAnyRole(["hr", "project_manager", "team_lead"])) {
    return (
      <AppShell>
        <ManagerDashboard />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PersonalDashboard />
    </AppShell>
  );
}

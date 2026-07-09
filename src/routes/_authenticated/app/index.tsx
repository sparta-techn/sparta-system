import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { PersonalDashboard } from "@/features/dashboard/components/personal-dashboard";
import { selectDashboardVariant } from "@/features/dashboard/select-dashboard-variant";
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
 * (B5 dashboard wiring). Owner/Admin get the company-wide cockpit; HR / Project
 * Managers get the operational manager view; everyone else (team leads,
 * employees, interns) gets the personal, check-in focused dashboard. Selection
 * is delegated to `selectDashboardVariant` so the rule is unit-tested. Route
 * guards still protect the deeper /app/executive and /app/manager pages; this
 * only picks the sensible landing view.
 */
function DashboardPage() {
  const { roles } = useAuth();
  const variant = selectDashboardVariant(roles);

  if (variant === "executive") {
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

  if (variant === "manager") {
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

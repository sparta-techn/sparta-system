import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { ManagerDashboard } from "@/features/manager/manager-dashboard";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/manager")({
  staticData: routeGuard({ roles: ["owner", "admin", "hr", "project_manager"] }),
  head: () => ({ meta: [{ title: "Manager Dashboard · SpartaFlow Hub" }] }),
  component: ManagerDashboardPage,
});

function ManagerDashboardPage() {
  return (
    <AppShell>
      <ManagerDashboard />
    </AppShell>
  );
}

import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ExportEmployeesButton } from "@/features/hr/components/export-employees-button";
import { HrSubnav } from "@/features/hr/components/hr-subnav";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/hr")({
  staticData: routeGuard({ permissions: ["employees.read"] }),
  head: () => ({ meta: [{ title: "HR · SpartaFlow Hub" }] }),
  component: HrLayout,
});

function HrLayout() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="People"
        title="HR workspace"
        description="Hire, manage, and support employees through their entire lifecycle."
        actions={<ExportEmployeesButton />}
      />
      <HrSubnav />
      <Outlet />
    </AppShell>
  );
}

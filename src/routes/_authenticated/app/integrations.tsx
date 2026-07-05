import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { IntegrationList } from "@/integrations/components";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/integrations")({
  staticData: routeGuard({ permissions: ["integrations.manage"] }),
  head: () => ({
    meta: [{ title: "Integration Center · SpartaFlow Hub" }],
  }),
  component: IntegrationCenterPage,
});

function IntegrationCenterPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Settings"
        title="Integration Center"
        description="Connect and monitor SpartaFlow's external providers — status, health, sync, errors, configuration and logs."
      />
      <IntegrationList />
    </AppShell>
  );
}

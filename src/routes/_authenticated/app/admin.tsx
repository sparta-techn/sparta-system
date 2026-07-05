import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { routeGuard } from "@/features/auth/route-guard";
import { AdminConsole } from "@/features/admin/components/admin-console";

export const Route = createFileRoute("/_authenticated/app/admin")({
  // Owner-only console (mirror of RLS intent).
  staticData: routeGuard({ roles: ["owner"] }),
  head: () => ({ meta: [{ title: "Admin Console · SpartaFlow Hub" }] }),
  component: AdminConsolePage,
});

function AdminConsolePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Platform"
        title="Admin Console"
        description="Owner controls for users, access, organization, and platform settings."
      />
      <AdminConsole />
    </AppShell>
  );
}

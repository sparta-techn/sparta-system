import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { routeGuard } from "@/features/auth/route-guard";
import { AuditLogView } from "@/features/audit/components/audit-log-view";

export const Route = createFileRoute("/_authenticated/app/audit")({
  // Security audit is owner/admin-scoped (mirror of RLS intent).
  staticData: routeGuard({ roles: ["owner", "admin"] }),
  head: () => ({ meta: [{ title: "Audit log · SpartaFlow Hub" }] }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Security"
        title="Audit log"
        description="A record of security-sensitive activity — sign-ins, access changes, and destructive actions."
      />
      <AuditLogView />
    </AppShell>
  );
}

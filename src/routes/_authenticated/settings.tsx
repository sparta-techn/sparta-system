import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { routeGuard } from "@/features/auth/route-guard";
import { OrganizationSettingsPanel } from "@/features/admin/components/organization-settings-panel";

export const Route = createFileRoute("/_authenticated/settings")({
  // Company-wide settings are owner/admin-scoped (mirror of RLS intent). The
  // sidebar item is likewise restricted, so only leadership reaches this route.
  staticData: routeGuard({ roles: ["owner", "admin"] }),
  head: () => ({ meta: [{ title: "Settings · SpartaFlow Hub" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Manage your organization's profile, working hours, and company-wide preferences."
      />
      <OrganizationSettingsPanel />
    </AppShell>
  );
}

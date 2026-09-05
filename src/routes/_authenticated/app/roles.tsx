import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RequireRolesPermission } from "@/features/roles/components/require-roles-permission";

/**
 * Layout for the dynamic role management screens.
 *
 * Access is gated by the DYNAMIC engine — `has_permission(uid, 'roles', 'view',
 * 'all')` — not by the legacy `app_role` enum, so a user reaches this area by
 * holding a role that grants it rather than by being an `owner`/`admin`.
 * `RequireRolesPermission` is the UX half; every read and write underneath is
 * re-authorized inside Postgres by a SECURITY DEFINER RPC.
 */
export const Route = createFileRoute("/_authenticated/app/roles")({
  head: () => ({ meta: [{ title: "Roles & permissions · SpartaFlow Hub" }] }),
  component: RolesLayout,
});

function RolesLayout() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Access"
        title="Roles & permissions"
        description="Define roles from the permission catalog and assign them to people."
      />
      <RequireRolesPermission action="view">
        <Outlet />
      </RequireRolesPermission>
    </AppShell>
  );
}

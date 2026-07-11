import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { OwnerDashboard } from "@/features/dashboard/components/owner-dashboard";
import { PersonalDashboard } from "@/features/dashboard/components/personal-dashboard";
import { selectDashboardVariant } from "@/features/dashboard/select-dashboard-variant";
import { ManagerDashboard } from "@/features/manager/manager-dashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [{ title: "Dashboard · SpartaFlow Hub" }],
  }),
  component: DashboardPage,
});

/**
 * Root dashboard — renders the variant that matches the signed-in user's role
 * (B5 dashboard wiring). Owner/Admin get the in-MVP Owner dashboard (people,
 * attendance, projects, tasks); HR / Project Managers get the operational
 * manager view; everyone else (team leads, employees, interns) gets the
 * personal, check-in focused dashboard. Selection is delegated to
 * `selectDashboardVariant` so the rule is unit-tested.
 *
 * The out-of-MVP Executive cockpit is intentionally NOT landed here — it lives
 * only at `/app/executive`, behind the Future Plan route gate. This route just
 * picks the sensible in-scope landing view.
 */
function DashboardPage() {
  const { roles } = useAuth();
  const variant = selectDashboardVariant(roles);

  if (variant === "owner") {
    return (
      <AppShell>
        <OwnerDashboard />
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

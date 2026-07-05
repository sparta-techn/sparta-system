import { createFileRoute } from "@tanstack/react-router";
import { FiltersBar } from "@/features/analytics/components/filters-bar";
import { HrDashboard } from "@/features/analytics/components/hr-dashboard";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/analytics/hr")({
  staticData: routeGuard({ roles: ["owner", "admin", "hr"] }),
  head: () => ({ meta: [{ title: "HR analytics · SpartaFlow Hub" }] }),
  component: () => (
    <>
      <FiltersBar scope="hr" />
      <HrDashboard />
    </>
  ),
});

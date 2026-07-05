import { createFileRoute } from "@tanstack/react-router";
import { FiltersBar } from "@/features/analytics/components/filters-bar";
import { ExecutiveDashboard } from "@/features/analytics/components/executive-dashboard";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/analytics/executive")({
  staticData: routeGuard({ permissions: ["dashboard.executive.view"] }),
  head: () => ({ meta: [{ title: "Executive analytics · SpartaFlow Hub" }] }),
  component: () => (
    <>
      <FiltersBar scope="executive" />
      <ExecutiveDashboard />
    </>
  ),
});

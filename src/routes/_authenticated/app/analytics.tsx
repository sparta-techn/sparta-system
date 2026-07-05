import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsFiltersProvider } from "@/features/analytics/filters-context";
import { AnalyticsSubnav } from "@/features/analytics/components/analytics-subnav";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/analytics")({
  staticData: routeGuard({ permissions: ["analytics.view"] }),
  head: () => ({ meta: [{ title: "Analytics · SpartaFlow Hub" }] }),
  component: AnalyticsLayout,
});

function AnalyticsLayout() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Insights"
        title="Performance & analytics"
        description="Trends, bottlenecks, and actionable insights across the company."
      />
      <AnalyticsFiltersProvider>
        <AnalyticsSubnav />
        <Outlet />
      </AnalyticsFiltersProvider>
    </AppShell>
  );
}

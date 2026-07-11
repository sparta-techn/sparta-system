import { createFileRoute } from "@tanstack/react-router";
import { HrKpiGrid } from "@/features/hr/components/hr-kpi-grid";
import {
  NewEmployeesWidget,
  PendingInvitationsWidget,
} from "@/features/hr/components/dashboard-widgets";

export const Route = createFileRoute("/_authenticated/app/hr/")({
  head: () => ({ meta: [{ title: "HR dashboard · SpartaFlow Hub" }] }),
  component: HrOverview,
});

function HrOverview() {
  return (
    <div className="space-y-6">
      <section aria-label="HR KPIs">
        <HrKpiGrid />
      </section>
      <section aria-label="People signals" className="grid gap-4 xl:grid-cols-2">
        <NewEmployeesWidget />
        <PendingInvitationsWidget />
      </section>
    </div>
  );
}

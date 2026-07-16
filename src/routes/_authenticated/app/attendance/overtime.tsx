import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { routeGuard } from "@/features/auth/route-guard";
import { OvertimeApprovalQueue } from "@/features/overtime/components/overtime-approval-queue";
import { OvertimePayPanel } from "@/features/overtime/components/overtime-pay-panel";
import { RequestOvertimeDialog } from "@/features/overtime/components/request-overtime-dialog";

export const Route = createFileRoute("/_authenticated/app/attendance/overtime")({
  // Reviewers (owner/admin/hr/project_manager/team_lead hold `attendance.review`)
  // may approve/reject and request overtime; RLS is the authoritative backstop.
  staticData: routeGuard({ permissions: ["attendance.review"] }),
  head: () => ({
    meta: [{ title: "Overtime · SpartaFlow Hub" }],
  }),
  component: OvertimePage,
});

function OvertimePage() {
  const { hasPermission } = useAuth();
  const canSeePay = hasPermission("payroll.view");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Attendance"
        title="Overtime"
        description="Approve or reject logged overtime, and request overtime ahead of time for an employee."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link to="/app/attendance/team">
                <ArrowLeft /> Team attendance
              </Link>
            </Button>
            <RequestOvertimeDialog />
          </div>
        }
      />

      <section aria-label="Pending overtime" className="mb-8 space-y-3">
        <h2 className="text-sm font-medium text-foreground">Awaiting approval</h2>
        <OvertimeApprovalQueue />
      </section>

      {canSeePay ? (
        <section aria-label="Overtime pay">
          <OvertimePayPanel />
        </section>
      ) : null}
    </AppShell>
  );
}

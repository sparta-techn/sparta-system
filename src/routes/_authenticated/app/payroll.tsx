import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { routeGuard } from "@/features/auth/route-guard";
import { PayrollExportPanel } from "@/features/payroll/components/payroll-export-panel";

export const Route = createFileRoute("/_authenticated/app/payroll")({
  // Payroll figures are Owner/Admin/HR only; RLS on payroll_report is the backstop.
  staticData: routeGuard({ permissions: ["payroll.view"] }),
  head: () => ({
    meta: [{ title: "Payroll · SpartaFlow Hub" }],
  }),
  component: PayrollPage,
});

function PayrollPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Payroll"
        title="Month-end payroll"
        description="Base pay, overtime and exceptions per employee for the month, exportable to Excel. Base and overtime are shown separately; unpaid absences are never netted away."
      />
      <PayrollExportPanel />
    </AppShell>
  );
}

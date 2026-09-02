import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ExportReportsCard } from "@/features/eod/components/export-reports-card";
import { ReviewQueue } from "@/features/report-review/components/review-queue";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/report-review")({
  staticData: routeGuard({ roles: ["owner", "admin", "hr", "project_manager", "team_lead"] }),
  head: () => ({ meta: [{ title: "Report reviews · SpartaFlow Hub" }] }),
  component: ReportReviewPage,
});

function ReportReviewPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="Report reviews"
        description="Approve or reject your team's submitted daily reports and status updates, and leave a note."
      />
      <div className="space-y-4">
        <ExportReportsCard scope="team" />
        <ReviewQueue />
      </div>
    </AppShell>
  );
}

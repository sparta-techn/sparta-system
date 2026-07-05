import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { TeamTodayGrid } from "@/features/attendance/components/team-today-grid";

export const Route = createFileRoute("/_authenticated/app/attendance/team")({
  head: () => ({
    meta: [{ title: "Team attendance · SpartaFlow Hub" }],
  }),
  component: TeamAttendancePage,
});

function TeamAttendancePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Attendance"
        title="Team today"
        description="Live attendance across the company. Updates in real time as people start, break and finish work."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/attendance">
              <ArrowLeft /> My day
            </Link>
          </Button>
        }
      />
      <TeamTodayGrid />
    </AppShell>
  );
}

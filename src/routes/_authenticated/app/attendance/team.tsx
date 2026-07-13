import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routeGuard } from "@/features/auth/route-guard";
import { TeamTodayGrid } from "@/features/attendance/components/team-today-grid";
import { TeamHistoryTable } from "@/features/attendance/components/team-history-table";

export const Route = createFileRoute("/_authenticated/app/attendance/team")({
  // Team-wide attendance is reviewer-only (owner/admin/hr/project_manager/team_lead
  // hold `attendance.review`); RLS is the authoritative backstop.
  staticData: routeGuard({ permissions: ["attendance.review"] }),
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
        title="Team attendance"
        description="Live status today, plus full attendance history you can export to Excel for any date range."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/attendance">
              <ArrowLeft /> My day
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="today" className="space-y-6">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="history">History &amp; export</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <TeamTodayGrid />
        </TabsContent>
        <TabsContent value="history">
          <TeamHistoryTable />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

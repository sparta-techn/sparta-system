import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, History } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { TodayStatusCard } from "@/features/attendance/components/today-status-card";
import { AttendanceHistoryTable } from "@/features/attendance/components/attendance-history-table";
import { useAttendanceReminders } from "@/features/attendance/hooks/use-attendance-reminders";
import { useTodaySession } from "@/features/attendance/hooks/use-today-session";

export const Route = createFileRoute("/_authenticated/app/attendance/")({
  head: () => ({
    meta: [{ title: "Attendance · SpartaFlow Hub" }],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { user, hasAnyRole } = useAuth();
  const todayQ = useTodaySession(user?.id ?? null);
  useAttendanceReminders(todayQ.data);

  const isManager = hasAnyRole(["owner", "admin", "hr", "project_manager", "team_lead"]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Attendance"
        title="My work day"
        description="Open your work session at the start of the day and close it when you finish. Breaks, hours and lateness are tracked automatically."
        actions={
          isManager ? (
            <div className="flex gap-2">
              <Button asChild variant="ghost">
                <Link to="/app/attendance/overtime">
                  <Clock /> Overtime
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/attendance/team">
                  Team view <ArrowRight />
                </Link>
              </Button>
            </div>
          ) : null
        }
      />

      <section aria-label="Today" className="mb-8">
        <TodayStatusCard />
      </section>

      <section aria-label="History" className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <History className="size-4 text-muted-foreground" aria-hidden />
          Attendance history
        </div>
        <AttendanceHistoryTable />
      </section>
    </AppShell>
  );
}

import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { CheckInWidget } from "@/features/checkin/components/check-in-widget";
import { CurrentTasks } from "@/features/dashboard/components/current-tasks";
import { DependenciesDashboardWidget } from "@/features/dependencies/components/dep-widgets";
import { EodWidget } from "@/features/eod/components/eod-widget";
import { MiddayReminder } from "@/features/midday/components/midday-reminder";
import { MiddayWidget } from "@/features/midday/components/midday-widget";
import {
  PendingActionsWidget,
  RecentNotificationsWidget,
} from "@/features/notifications/components/notification-widgets";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { QuickSummary } from "@/features/dashboard/components/quick-summary";
import { ActivityTimeline } from "@/features/dashboard/components/activity-timeline";
import { TeamSnapshot } from "@/features/dashboard/components/team-snapshot";
import { TodayStatusCard } from "@/features/attendance/components/today-status-card";
import { useAttendanceReminders } from "@/features/attendance/hooks/use-attendance-reminders";
import { useTodaySession } from "@/features/attendance/hooks/use-today-session";

/**
 * Personal dashboard — the check-in-focused view for individual contributors
 * (employee / intern and any role without an elevated company-wide cockpit).
 * Attendance reminders live here so they only fire for people who check in.
 */
export function PersonalDashboard() {
  const { profile, user } = useAuth();
  const todayQ = useTodaySession(user?.id ?? null);
  useAttendanceReminders(todayQ.data);
  const greetingName =
    profile?.display_name ?? profile?.full_name ?? user?.email?.split("@")[0] ?? "there";
  const hour = new Date().getHours();
  const salute = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={`${salute}, ${greetingName}`}
        description="Here's your day at a glance. Start with a check-in, then knock out what matters."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/attendance/team">View team</Link>
            </Button>
            <Button asChild>
              <Link to="/app/check-in">Fill check-in</Link>
            </Button>
          </>
        }
      />

      <section
        aria-label="Today status"
        className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <TodayStatusCard />
        <QuickActions />
      </section>

      <section aria-label="Quick summary" className="mb-6">
        <QuickSummary />
      </section>

      <section aria-label="Work" className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CurrentTasks />
        </div>
        <div className="space-y-4">
          <CheckInWidget />
          <MiddayWidget />
          <EodWidget />
        </div>
      </section>

      <section aria-label="Collaboration" className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DependenciesDashboardWidget />
        </div>
        <TeamSnapshot />
      </section>

      <section aria-label="Activity" className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityTimeline />
        </div>
        <div className="space-y-4">
          <RecentNotificationsWidget />
          <PendingActionsWidget />
        </div>
      </section>
      <MiddayReminder />
    </>
  );
}

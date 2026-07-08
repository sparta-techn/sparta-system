import { Bell, CheckCircle2, Clock, Hourglass, ListChecks, Workflow } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { mockSummary } from "../mock-data";

export function QuickSummary() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Today's tasks"
        value={mockSummary.totalTasks}
        icon={ListChecks}
        hint="Across 3 projects"
      />
      <StatCard
        label="Completed"
        value={mockSummary.completed}
        icon={CheckCircle2}
        trend={{ direction: "up", value: "+1", intent: "positive" }}
      />
      <StatCard label="Pending" value={mockSummary.pending} icon={Hourglass} hint="2 due today" />
      <StatCard
        label="Dependencies"
        value={mockSummary.dependenciesWaiting}
        icon={Workflow}
        hint="Waiting on others"
      />
      <StatCard
        label="Notifications"
        value={mockSummary.notifications}
        icon={Bell}
        hint="3 unread"
      />
      <StatCard
        label="Hours worked"
        value={mockSummary.hoursWorked}
        icon={Clock}
        hint="of 8h target"
      />
    </div>
  );
}

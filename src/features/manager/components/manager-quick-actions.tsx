import { useState } from "react";
import { Bell, Download, Megaphone, UserPlus, Users, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { InviteEmployeeDialog } from "@/features/hr/components/invite-employee-dialog";
import { teamTodayQuery } from "@/features/attendance/queries";
import type { TeammateToday } from "@/features/attendance/api";

import { useSendReminders } from "../hooks/use-send-reminders";

/** Columns for the team attendance CSV export (today's roster), in order. */
const TEAM_ATTENDANCE_COLUMNS: CsvColumn<TeammateToday>[] = [
  { header: "Name", value: (t) => t.profile.display_name ?? t.profile.full_name ?? "—" },
  { header: "Date", value: (t) => t.session.work_date },
  { header: "Status", value: (t) => t.session.attendance_status },
  { header: "Started", value: (t) => t.session.started_at ?? "" },
  { header: "Finished", value: (t) => t.session.finished_at ?? "" },
  { header: "Hours worked", value: (t) => ((t.session.working_seconds ?? 0) / 3600).toFixed(2) },
];

interface QuickAction {
  label: string;
  icon: LucideIcon;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ManagerQuickActions() {
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { send: handleSendReminder, sending: sendingReminder } = useSendReminders();
  const { data: team = [] } = useQuery(teamTodayQuery());

  const handleExportAttendance = () => {
    if (team.length === 0) {
      toast.info("No team attendance to export yet today.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`team-attendance-${stamp}.csv`, toCsv(team, TEAM_ATTENDANCE_COLUMNS));
    toast.success(`Exported ${team.length} attendance record${team.length === 1 ? "" : "s"}`);
  };

  const actions: QuickAction[] = [
    {
      label: "Send reminder",
      icon: Bell,
      hint: "Nudge missing reports",
      onClick: handleSendReminder,
      disabled: sendingReminder,
    },
    {
      label: "Create announcement",
      icon: Megaphone,
      hint: "Post company update",
      onClick: () => navigate({ to: "/app/hr/announcements" }),
    },
    {
      label: "Assign dependency",
      icon: Workflow,
      hint: "Route new blocker",
      onClick: () => navigate({ to: "/app/dependencies" }),
    },
    {
      label: "View team",
      icon: Users,
      hint: "Open team attendance",
      onClick: () => navigate({ to: "/app/attendance/team" }),
    },
    {
      label: "Invite member",
      icon: UserPlus,
      hint: "Send invitation",
      onClick: () => setInviteOpen(true),
    },
    {
      label: "Export attendance",
      icon: Download,
      hint: "Download CSV",
      onClick: handleExportAttendance,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
        <CardDescription>Common manager workflows in one click.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant="outline"
              className="h-auto justify-start gap-3 px-3 py-3 text-left"
              onClick={a.onClick}
              disabled={a.disabled}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <a.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {a.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{a.hint}</span>
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
      <InviteEmployeeDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </Card>
  );
}

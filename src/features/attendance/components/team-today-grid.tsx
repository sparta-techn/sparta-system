import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { StatCard } from "@/components/stat-card";
import { Activity, Coffee, LogOut, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { attendanceKeys, teamTodayQuery } from "../queries";
import { AttendanceBadge, SessionStatusBadge } from "./attendance-status-badge";
import { formatDurationLong } from "../hooks/use-timer";

export function TeamTodayGrid() {
  const qc = useQueryClient();
  const q = useQuery(teamTodayQuery());

  // Realtime: any change in today's sessions across the team
  useEffect(() => {
    const channel = supabase
      .channel("attendance:team-today")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_sessions" },
        () => {
          void qc.invalidateQueries({ queryKey: attendanceKeys.team() });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  if (q.isPending) return <ListSkeleton rows={6} />;
  if (q.isError) {
    return (
      <ErrorState
        title="Couldn't load team status"
        description={(q.error as Error)?.message}
      />
    );
  }
  const rows = q.data ?? [];

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.session.session_status] = (acc[r.session.session_status] ?? 0) + 1;
      if (r.session.attendance_status === "late") acc.late = (acc.late ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Working" value={counts.working ?? 0} icon={Activity} />
        <StatCard label="On break" value={counts.on_break ?? 0} icon={Coffee} />
        <StatCard label="Finished" value={counts.finished ?? 0} icon={LogOut} />
        <StatCard label="Late" value={counts.late ?? 0} icon={Timer} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team today</CardTitle>
          <CardDescription>
            Live view of work sessions across the company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="No sessions yet today"
              description="Once teammates start their day, they'll show up here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map(({ session, profile }) => {
                const name = profile.display_name ?? profile.full_name ?? "Unnamed";
                const initials = name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((s) => s[0]?.toUpperCase() ?? "")
                  .join("");
                return (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <Avatar className="size-9 shrink-0">
                      {profile.avatar_url ? (
                        <AvatarImage src={profile.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback className="bg-muted text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profile.job_title ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SessionStatusBadge status={session.session_status} size="sm" />
                      <AttendanceBadge status={session.attendance_status} size="sm" />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {session.started_at
                          ? new Date(session.started_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                        {" · "}
                        {formatDurationLong(session.working_seconds)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

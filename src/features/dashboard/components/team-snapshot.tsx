import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TeammateToday } from "@/features/attendance/api";
import { teamTodayQuery } from "@/features/attendance/queries";

type SnapStatus = "working" | "on_break" | "late" | "offline";

const DOT: Record<SnapStatus, string> = {
  working: "bg-success",
  on_break: "bg-info",
  late: "bg-warning",
  offline: "bg-muted-foreground/40",
};

const LABEL: Record<SnapStatus, string> = {
  working: "Working",
  on_break: "On break",
  late: "Late",
  offline: "Offline",
};

/** Map a live work session to the snapshot's coarse presence status. */
function statusOf(t: TeammateToday): SnapStatus {
  switch (t.session.session_status) {
    case "working":
      return t.session.attendance_status === "late" ? "late" : "working";
    case "on_break":
      return "on_break";
    default:
      return "offline";
  }
}

function nameOf(p: TeammateToday["profile"]): string {
  return p.full_name || p.display_name || "Unknown";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function TeamSnapshot() {
  const { data: team = [], isLoading, isError } = useQuery(teamTodayQuery());

  const members = team.map((t) => ({
    id: t.profile.id,
    name: nameOf(t.profile),
    initials: initialsOf(nameOf(t.profile)),
    role: t.profile.job_title ?? "—",
    status: statusOf(t),
  }));

  const counts = members.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<SnapStatus, number>,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team snapshot</CardTitle>
        <CardDescription>Who's around right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <p className="text-sm text-muted-foreground">Couldn't load the team's status.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team status…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has clocked in yet today.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(["working", "on_break", "late", "offline"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", DOT[s])} aria-hidden />
                  <span className="tabular-nums text-foreground">{counts[s] ?? 0}</span> {LABEL[s]}
                </span>
              ))}
            </div>
            <TooltipProvider delayDuration={150}>
              <ul className="flex flex-wrap gap-2">
                {members.map((t) => (
                  <li key={t.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${t.name} — ${LABEL[t.status]}`}
                          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-muted text-xs font-semibold">
                              {t.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card",
                              DOT[t.status],
                            )}
                            aria-hidden
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.role} · {LABEL[t.status]}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          </>
        )}
      </CardContent>
    </Card>
  );
}

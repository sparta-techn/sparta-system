import {
  Bell, BookCheck, ClipboardCheck, Coffee, GaugeCircle,
  LogIn, LogOut, PlayCircle, Sun, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { managerActivity, type ManagerActivity } from "../mock-data";

const ICONS: Record<ManagerActivity["kind"], LucideIcon> = {
  check_in: LogIn,
  break_start: Coffee,
  break_end: PlayCircle,
  checkin_submitted: Sun,
  midday_submitted: GaugeCircle,
  eod_submitted: ClipboardCheck,
  dependency_created: Workflow,
  dependency_resolved: BookCheck,
  check_out: LogOut,
};
const TONES: Record<ManagerActivity["kind"], string> = {
  check_in: "bg-success-soft text-success",
  break_start: "bg-info-soft text-info",
  break_end: "bg-info-soft text-info",
  checkin_submitted: "bg-primary-soft text-primary",
  midday_submitted: "bg-primary-soft text-primary",
  eod_submitted: "bg-primary-soft text-primary",
  dependency_created: "bg-warning-soft text-warning",
  dependency_resolved: "bg-success-soft text-success",
  check_out: "bg-muted text-muted-foreground",
};

export function LiveActivityFeed() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4 text-primary" aria-hidden />
            Live activity
          </CardTitle>
          <CardDescription>Real-time events across the team. Newest first.</CardDescription>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden /> Live
        </span>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px] pr-3">
          <ol className="relative space-y-3 border-l border-border pl-4">
            {managerActivity.map((a) => {
              const Icon = ICONS[a.kind];
              return (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[26px] grid size-6 place-items-center rounded-full ${TONES[a.kind]}`} aria-hidden>
                    <Icon className="size-3" />
                  </span>
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-foreground">
                        <span className="font-medium">{a.actor}</span> · <span className="text-muted-foreground">{a.detail}</span>
                      </p>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{a.minutesAgo}m</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

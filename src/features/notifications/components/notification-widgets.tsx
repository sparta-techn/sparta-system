import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Bell, Inbox, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

import { getCurrentUserId } from "../directory";
import { notificationStore, useMinuteTick, useNotifications } from "../store";
import { formatRelative, iconFor, toneClass } from "../ui";

/** Compact card for the employee dashboard. */
export function RecentNotificationsWidget() {
  const userId = getCurrentUserId();
  useMinuteTick();
  const all = useNotifications(userId);
  const recent = all.filter((n) => !n.archivedAt).slice(0, 5);
  const unread = all.filter((n) => !n.readAt && !n.archivedAt).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-primary" aria-hidden /> Notifications
            {unread > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
                {unread}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>Latest activity routed to you.</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={unread === 0}
          onClick={() => notificationStore.markAllRead(userId)}
        >
          Mark all read
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Inbox className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No notifications</p>
            <p className="text-xs text-muted-foreground">
              You'll see mentions, blockers and reminders here.
            </p>
          </div>
        ) : (
          recent.map((n) => {
            const Icon = iconFor(n);
            const unreadRow = !n.readAt;
            return (
              <Link
                key={n.id}
                to={(n.href ?? "/app/notifications") as never}
                onClick={() => unreadRow && notificationStore.markRead(n.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent/40",
                  unreadRow && "bg-primary-soft/30",
                )}
              >
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full",
                    toneClass(n.type),
                  )}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                </div>
                {unreadRow ? (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                ) : null}
              </Link>
            );
          })
        )}
        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link to="/app/notifications">
            Open notification center <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Pending actions surfaced from the notification stream. */
export function PendingActionsWidget() {
  const userId = getCurrentUserId();
  useMinuteTick();
  const all = useNotifications(userId);
  const pending = all
    .filter(
      (n) =>
        !n.readAt &&
        !n.archivedAt &&
        (n.priority === "high" || n.priority === "critical" || n.type === "reminder"),
    )
    .slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4 text-primary" aria-hidden /> Pending actions
        </CardTitle>
        <CardDescription>What needs you right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            Nothing waiting on you. Nice.
          </p>
        ) : (
          pending.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
              </div>
              {n.href ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={n.href as never}>Open</Link>
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** Manager widget — surfaces team-wide alerts. */
export function ManagerAlertsWidget() {
  const userId = getCurrentUserId();
  useMinuteTick();
  const all = useNotifications(userId);
  const critical = all
    .filter((n) => !n.archivedAt && (n.priority === "critical" || n.type === "critical"))
    .slice(0, 5);
  const missingReports = all.filter(
    (n) => !n.archivedAt && n.category === "reports" && n.type === "reminder",
  ).length;
  const lateEmployees = all.filter(
    (n) =>
      !n.archivedAt && (n.eventName === "attendance.absent" || n.eventName === "attendance.late"),
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-warning" aria-hidden /> Team alerts
        </CardTitle>
        <CardDescription>Operational signals from across your team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <KpiTile label="Critical" value={critical.length} tone="danger" />
          <KpiTile label="Missing reports" value={missingReports} tone="warning" />
          <KpiTile label="Late / absent" value={lateEmployees} tone="warning" />
        </div>
        <div className="space-y-1">
          {critical.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              No critical issues right now.
            </p>
          ) : (
            critical.map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-2 rounded-md border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="danger" label="Critical" size="sm" />
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                </div>
                {n.href ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={n.href as never}>Open</Link>
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "neutral";
}) {
  const cls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums", cls)}>{value}</p>
    </div>
  );
}

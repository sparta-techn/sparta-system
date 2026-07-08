import {
  Bell,
  MessageSquare,
  Megaphone,
  Workflow,
  Clock,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockNotifications, type MockNotification } from "../mock-data";
import { cn } from "@/lib/utils";

const ICONS: Record<MockNotification["kind"], LucideIcon> = {
  dependency: Workflow,
  message: MessageSquare,
  reminder: Clock,
  announcement: Megaphone,
  status: Activity,
};

export function NotificationsWidget() {
  const unread = mockNotifications.filter((n) => n.unread).length;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" aria-hidden /> Notifications
            {unread > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
                {unread}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>Latest activity in your workspace.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Mark all read
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {mockNotifications.map((n) => {
          const Icon = ICONS[n.kind];
          return (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent/40",
                n.unread && "bg-primary-soft/30",
              )}
            >
              <div
                className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                aria-hidden
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {n.time}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{n.description}</p>
              </div>
              {n.unread ? (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

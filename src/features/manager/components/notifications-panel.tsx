import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { managerNotifications, type ManagerNotification } from "../mock-data";

const ICONS: Record<ManagerNotification["level"], LucideIcon> = {
  critical: AlertOctagon, warning: AlertTriangle, info: Info,
};
const TONES: Record<ManagerNotification["level"], string> = {
  critical: "bg-destructive-soft text-destructive border-destructive/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  info: "bg-info-soft text-info border-info/30",
};

export function NotificationsPanel() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Alerts & notifications</CardTitle>
          <CardDescription>Critical first. Tap to act.</CardDescription>
        </div>
        <Button variant="ghost" size="sm">Mark read</Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {managerNotifications.map((n) => {
            const Icon = ICONS[n.level];
            return (
              <li key={n.id} className={`flex items-start gap-3 rounded-lg border p-3 ${TONES[n.level]}`}>
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

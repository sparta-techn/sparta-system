import { useMemo, type ReactNode } from "react";
import {
  Archive,
  ArchiveX,
  BellRing,
  CalendarClock,
  Gauge,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  UserX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/states";
import type { Alert, AlertSeverity, AlertType } from "@/services/alerts";
import { alertEngineInput } from "../alerts/mock-data";
import type { AlertEvent, StoredAlert } from "../alerts/alert-store";
import { useExecutiveAlerts } from "../hooks/use-executive-alerts";
import { DashboardSection } from "./dashboard-section";

const TYPE_META: Record<AlertType, { label: string; icon: LucideIcon }> = {
  project_overdue: { label: "Project overdue", icon: CalendarClock },
  sprint_delayed: { label: "Sprint delayed", icon: Gauge },
  employee_missing_reports: { label: "Missing reports", icon: UserX },
  attendance_anomaly: { label: "Attendance anomaly", icon: CalendarClock },
  high_workload: { label: "High workload", icon: Gauge },
  critical_blocker: { label: "Critical blocker", icon: TriangleAlert },
  ai_risk: { label: "AI risk", icon: Sparkles },
};

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  critical: "bg-destructive text-destructive-foreground border-transparent",
  high: "bg-warning text-warning-foreground border-transparent",
  medium: "bg-secondary text-secondary-foreground border-transparent",
  low: "bg-muted text-muted-foreground border-transparent",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AlertRow({ alert, actions }: { alert: Alert; actions?: ReactNode }) {
  const meta = TYPE_META[alert.type];
  const Icon = meta.icon;
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
          aria-hidden
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`capitalize ${SEVERITY_CLASS[alert.severity]}`}>
              {alert.severity}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {alert.priority}
            </Badge>
            <span className="text-xs text-muted-foreground">{meta.label}</span>
            {alert.evidence ? (
              <span className="text-xs font-medium tabular-nums text-foreground">
                · {alert.evidence}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-foreground">{alert.title}</p>
          <p className="text-sm text-muted-foreground">{alert.description}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Executive Alerts — surfaces alerts from the Alert Engine and their lifecycle
 * (dismiss / archive / history). The engine ranks by priority then severity.
 */
export function AlertsSection() {
  // Stable input reference so the engine evaluates once on mount.
  const input = useMemo(() => alertEngineInput, []);
  const { active, archived, history, refresh, dismiss, archive, restore, clearArchived } =
    useExecutiveAlerts(input);

  return (
    <DashboardSection
      id="alerts"
      title="Executive Alerts"
      description="Automatically raised from delivery, people, and AI signals — ranked by priority."
      actions={
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" aria-hidden />
          Re-evaluate
        </Button>
      }
    >
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <BellRing className="size-4" aria-hidden /> Active
            {active.length > 0 ? <Badge variant="secondary">{active.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="size-4" aria-hidden /> Archived
            {archived.length > 0 ? <Badge variant="secondary">{archived.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <RotateCcw className="size-4" aria-hidden /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {active.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="No active alerts"
              description="Everything is within thresholds."
            />
          ) : (
            <div className="space-y-3">
              {active.map((s: StoredAlert) => (
                <AlertRow
                  key={s.alert.id}
                  alert={s.alert}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Archive alert"
                        onClick={() => archive(s.alert.id)}
                      >
                        <Archive className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Dismiss alert"
                        onClick={() => dismiss(s.alert.id)}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          {archived.length === 0 ? (
            <EmptyState icon={Archive} title="Nothing archived" />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearArchived}>
                  <ArchiveX className="size-4" aria-hidden />
                  Clear archived
                </Button>
              </div>
              {archived.map((s: StoredAlert) => (
                <AlertRow
                  key={s.alert.id}
                  alert={s.alert}
                  actions={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Restore alert"
                      onClick={() => restore(s.alert.id)}
                    >
                      <RotateCcw className="size-4" aria-hidden />
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {history.length === 0 ? (
            <EmptyState icon={RotateCcw} title="No history yet" />
          ) : (
            <ol className="space-y-2">
              {history.map((e: AlertEvent) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium capitalize text-foreground">{e.kind}</span>
                    <span className="text-muted-foreground"> · {e.title}</span>
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground">{formatTime(e.at)}</time>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </DashboardSection>
  );
}

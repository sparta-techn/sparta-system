import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states";
import { cn } from "@/lib/utils";
import { managerBlockers, type ManagerBlocker } from "../mock-data";

const PRIORITY_TONE: Record<ManagerBlocker["priority"], "neutral" | "info" | "warning" | "danger"> =
  {
    low: "neutral",
    medium: "info",
    high: "warning",
    urgent: "danger",
  };

export function BlockersPanel() {
  const blockers = [...managerBlockers].sort((a, b) => b.ageHours - a.ageHours);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" aria-hidden />
            Blockers
          </CardTitle>
          <CardDescription>
            What's stuck, who owns it, and how long it's been waiting.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm">
          View all
        </Button>
      </CardHeader>
      <CardContent>
        {blockers.length === 0 ? (
          <EmptyState
            title="No active blockers"
            description="Nothing on the critical path right now."
          />
        ) : (
          <ul className="space-y-2">
            {blockers.map((b) => (
              <li
                key={b.id}
                className={cn(
                  "rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40",
                  b.priority === "urgent" ? "border-destructive/40" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">{b.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{b.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground">{b.employee}</span> waiting on{" "}
                      <span className="text-foreground">{b.owner}</span> · {b.department}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge
                      tone={PRIORITY_TONE[b.priority]}
                      label={b.priority.toUpperCase()}
                      size="sm"
                      withDot={false}
                    />
                    <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                      <Clock className="size-3" aria-hidden /> {b.ageHours}h
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge
                    tone={
                      b.status === "escalated"
                        ? "danger"
                        : b.status === "blocked"
                          ? "warning"
                          : "info"
                    }
                    label={
                      b.status === "escalated"
                        ? "Escalated"
                        : b.status === "blocked"
                          ? "Blocked"
                          : "Pending"
                    }
                    size="sm"
                  />
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Resolve <ArrowRight className="size-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

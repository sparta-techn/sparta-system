import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states";
import type { ExecRisk, RiskSeverity } from "../types";
import { DashboardSection } from "./dashboard-section";

const SEVERITY_CLASS: Record<RiskSeverity, string> = {
  high: "bg-destructive text-destructive-foreground border-transparent",
  medium: "bg-warning text-warning-foreground border-transparent",
  low: "bg-secondary text-secondary-foreground border-transparent",
};

const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };

/** Upcoming Risks — severity-ranked list of what needs leadership attention. */
export function UpcomingRisksSection({ risks }: { risks: ExecRisk[] }) {
  const ordered = [...risks].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return (
    <DashboardSection
      id="risks"
      title="Upcoming Risks"
      description="Blockers, slips, and compliance gaps ranked by severity."
    >
      {ordered.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No open risks"
          description="Nothing needs escalation right now."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {ordered.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning"
                  aria-hidden
                >
                  <AlertTriangle className="size-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`capitalize ${SEVERITY_CLASS[r.severity]}`}>
                      {r.severity}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {r.area}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.dueLabel}</span>
                  </div>
                  <p className="text-sm text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">Owner: {r.owner}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

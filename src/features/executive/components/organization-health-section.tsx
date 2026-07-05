import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  computeOrganizationHealth,
  BAND_LABEL,
  type HealthBand,
  type HealthMetric,
} from "@/services/health";
import type { ExecutiveKpis } from "@/services/kpi";
import { cn } from "@/lib/utils";
import { organizationHealthExtras } from "../health/mock-data";
import { deriveOrganizationHealthInput } from "../health/organization-health";
import { DashboardSection } from "./dashboard-section";

const BAND_BADGE: Record<HealthBand, string> = {
  excellent: "bg-success text-success-foreground border-transparent",
  good: "bg-primary text-primary-foreground border-transparent",
  needs_attention: "bg-warning text-warning-foreground border-transparent",
  critical: "bg-destructive text-destructive-foreground border-transparent",
};

const BAND_TEXT: Record<HealthBand, string> = {
  excellent: "text-success",
  good: "text-primary",
  needs_attention: "text-warning",
  critical: "text-destructive",
};

function BandBadge({ band }: { band: HealthBand }) {
  return <Badge className={BAND_BADGE[band]}>{BAND_LABEL[band]}</Badge>;
}

function HealthCard({ metric }: { metric: HealthMetric }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{metric.label}</CardTitle>
          <BandBadge band={metric.band} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-display text-3xl font-semibold tabular-nums",
              BAND_TEXT[metric.band],
            )}
          >
            {metric.score}
          </span>
          <span className="text-xs text-muted-foreground">/ 100 · {metric.summary}</span>
        </div>
        <Progress value={metric.score} className="h-2" />
        <ul className="space-y-1">
          {metric.factors.map((f) => (
            <li
              key={f.label}
              className="flex items-center justify-between text-xs text-muted-foreground"
            >
              <span>{f.label}</span>
              <span className="tabular-nums text-foreground">{f.value}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Organization Health — seven composite health metrics, each banded Excellent /
 * Good / Needs Attention / Critical. Scores are derived from the computed KPI
 * groups via the health service; no metric math is duplicated here.
 */
export function OrganizationHealthSection({ kpis }: { kpis: ExecutiveKpis }) {
  const health = useMemo(
    () => computeOrganizationHealth(deriveOrganizationHealthInput(kpis, organizationHealthExtras)),
    [kpis],
  );

  const overall = health.overall;
  const domains = [
    health.engineering,
    health.hr,
    health.project,
    health.attendance,
    health.collaboration,
    health.aiConfidence,
  ];

  return (
    <DashboardSection
      id="organization-health"
      title="Organization Health"
      description="Composite health across every domain, rolled up into one organization score."
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="ring-1 ring-border xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Overall Organization Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-3">
              <span
                className={cn(
                  "font-display text-5xl font-bold tabular-nums",
                  BAND_TEXT[overall.band],
                )}
              >
                {overall.score}
              </span>
              <div className="pb-1">
                <BandBadge band={overall.band} />
              </div>
            </div>
            <Progress value={overall.score} className="h-2.5" />
            <p className="text-sm text-muted-foreground">{overall.summary}</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
              {overall.factors.map((f) => (
                <li
                  key={f.label}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>{f.label}</span>
                  <span className="tabular-nums text-foreground">{f.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-3">
          {domains.map((m) => (
            <HealthCard key={m.key} metric={m} />
          ))}
        </div>
      </div>
    </DashboardSection>
  );
}

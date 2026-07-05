import { AlertTriangle, ArrowUpRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Insight } from "../types";

const TONE = {
  positive: { ring: "ring-success/20", bg: "bg-success-soft", fg: "text-success", Icon: TrendingUp },
  negative: { ring: "ring-destructive/20", bg: "bg-destructive-soft", fg: "text-destructive", Icon: TrendingDown },
  warning: { ring: "ring-warning/20", bg: "bg-warning-soft", fg: "text-warning", Icon: AlertTriangle },
  neutral: { ring: "ring-primary/20", bg: "bg-primary-soft", fg: "text-primary", Icon: Sparkles },
} as const;

export function InsightCard({ insight }: { insight: Insight }) {
  const t = TONE[insight.intent];
  const Icon = t.Icon;
  return (
    <Card className={cn("group relative overflow-hidden ring-1", t.ring)}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", t.bg, t.fg)} aria-hidden>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{insight.title}</h4>
            {insight.delta ? (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums", t.bg, t.fg)}>
                {insight.delta}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{insight.description}</p>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" aria-hidden />
      </CardContent>
    </Card>
  );
}

export function InsightGrid({ insights }: { insights: Insight[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: {
    direction: "up" | "down" | "flat";
    value: string;
    intent?: "positive" | "negative" | "neutral";
  };
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, trend, className }: StatCardProps) {
  const trendIntent =
    trend?.intent ??
    (trend?.direction === "up" ? "positive" : trend?.direction === "down" ? "negative" : "neutral");
  const trendColor =
    trendIntent === "positive"
      ? "text-success"
      : trendIntent === "negative"
        ? "text-destructive"
        : "text-muted-foreground";
  const TrendIcon =
    trend?.direction === "up" ? ArrowUpRight : trend?.direction === "down" ? ArrowDownRight : Minus;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className="font-display text-3xl font-semibold tracking-tight text-foreground tabular-nums"
            data-tabular
          >
            {value}
          </p>
          {trend ? (
            <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
              <TrendIcon className="size-3.5" aria-hidden />
              <span className="tabular-nums">{trend.value}</span>
              {hint ? <span className="text-muted-foreground">· {hint}</span> : null}
            </div>
          ) : hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

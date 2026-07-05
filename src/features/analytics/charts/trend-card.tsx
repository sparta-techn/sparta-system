import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BenchmarkValue } from "../types";

interface TrendCardProps {
  label: string;
  value: BenchmarkValue;
  positiveIsDown?: boolean;
  hint?: string;
  className?: string;
}

function format(v: number, f: BenchmarkValue["format"]) {
  if (f === "percent") return `${Math.round(v)}%`;
  if (f === "hours") return `${v}h`;
  if (f === "minutes") return `${v}m`;
  return `${v}`;
}

export function TrendCard({ label, value, positiveIsDown, hint, className }: TrendCardProps) {
  const delta = value.current - value.previous;
  const pct = value.previous === 0 ? 0 : (delta / value.previous) * 100;
  const dir: "up" | "down" | "flat" = Math.abs(delta) < 0.01 ? "flat" : delta > 0 ? "up" : "down";
  const isPositive = dir === "flat" ? false : positiveIsDown ? dir === "down" : dir === "up";
  const intentClass =
    dir === "flat"
      ? "text-muted-foreground"
      : isPositive
        ? "text-success"
        : "text-destructive";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="space-y-1.5 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-semibold tabular-nums text-foreground">
          {format(value.current, value.format)}
        </p>
        <div className={cn("flex items-center gap-1 text-xs", intentClass)}>
          <Icon className="size-3.5" aria-hidden />
          <span className="tabular-nums">
            {dir === "flat" ? "no change" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
          </span>
          <span className="text-muted-foreground">
            · vs {format(value.previous, value.format)}
            {hint ? ` · ${hint}` : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

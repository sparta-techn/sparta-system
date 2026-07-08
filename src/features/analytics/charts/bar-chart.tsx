import { cn } from "@/lib/utils";

interface BarSeries {
  label: string;
  values: number[];
}

interface BarChartProps {
  data: { label: string; value: number }[] | { label: string; [k: string]: number | string }[];
  series?: BarSeries[];
  height?: number;
  className?: string;
  colorClasses?: string[];
  ariaLabel?: string;
}

export function BarChart({
  data,
  series,
  height = 200,
  className,
  colorClasses = ["fill-primary", "fill-success", "fill-warning"],
  ariaLabel = "Bar chart",
}: BarChartProps) {
  const w = 600;
  const h = height;
  const pad = { t: 12, r: 12, b: 24, l: 32 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const seriesCount = series ? series.length : 1;
  const getValues = (row: Record<string, unknown>): number[] => {
    if (series) return series.map((s) => Number(row[s.label] ?? 0));
    return [Number((row as { value: number }).value)];
  };
  const max = Math.max(1, ...data.flatMap((row) => getValues(row as Record<string, unknown>)));
  const groupW = iw / data.length;
  const barW = (groupW * 0.7) / seriesCount;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const ty = pad.t + ih * p;
        return (
          <g key={i}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={ty}
              y2={ty}
              className="stroke-border/60"
              strokeDasharray="2 4"
            />
            <text
              x={pad.l - 6}
              y={ty + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {Math.round(max * (1 - p))}
            </text>
          </g>
        );
      })}
      {data.map((row, i) => {
        const values = getValues(row as Record<string, unknown>);
        const gx = pad.l + groupW * i + groupW * 0.15;
        return (
          <g key={i}>
            {values.map((v, j) => {
              const bh = (v / max) * ih;
              return (
                <rect
                  key={j}
                  x={gx + barW * j}
                  y={pad.t + ih - bh}
                  width={barW - 2}
                  height={bh}
                  rx={2}
                  className={colorClasses[j % colorClasses.length]}
                />
              );
            })}
            <text
              x={pad.l + groupW * i + groupW / 2}
              y={h - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {(row as { label: string }).label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

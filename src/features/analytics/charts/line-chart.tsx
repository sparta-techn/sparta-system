import type { TrendPoint } from "../types";
import { cn } from "@/lib/utils";

interface LineChartProps {
  data: TrendPoint[];
  height?: number;
  className?: string;
  colorClass?: string;
  showDots?: boolean;
  showGrid?: boolean;
  ariaLabel?: string;
  formatValue?: (n: number) => string;
}

export function LineChart({
  data,
  height = 200,
  className,
  colorClass = "stroke-primary",
  showDots = true,
  showGrid = true,
  ariaLabel = "Line chart",
  formatValue = (n) => String(n),
}: LineChartProps) {
  const w = 600;
  const h = height;
  const pad = { t: 12, r: 12, b: 24, l: 32 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = Math.max(1, max - min);
  const x = (i: number) => pad.l + (i * iw) / Math.max(1, data.length - 1);
  const y = (v: number) => pad.t + ih - ((v - min) / range) * ih;
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `M ${x(0)},${y(min)} L ${data.map((d, i) => `${x(i)},${y(d.value)}`).join(" L ")} L ${x(data.length - 1)},${y(min)} Z`;
  const ticks = 4;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {showGrid &&
        Array.from({ length: ticks + 1 }).map((_, i) => {
          const ty = pad.t + (ih * i) / ticks;
          const tv = max - (range * i) / ticks;
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
                {formatValue(Math.round(tv))}
              </text>
            </g>
          );
        })}
      <path
        d={area}
        className={cn("fill-current opacity-10", colorClass.replace("stroke-", "text-"))}
      />
      <polyline fill="none" strokeWidth={2} className={colorClass} points={points} />
      {showDots &&
        data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(d.value)}
            r={3}
            className={cn("fill-background", colorClass)}
            strokeWidth={2}
          />
        ))}
      {data.map((d, i) => (
        <text
          key={i}
          x={x(i)}
          y={h - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

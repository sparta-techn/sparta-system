import { cn } from "@/lib/utils";

interface DonutChartProps {
  data: { label: string; value: number; colorClass?: string }[];
  size?: number;
  thickness?: number;
  className?: string;
  centerLabel?: string;
  centerValue?: string;
  ariaLabel?: string;
}

const PALETTE = [
  "fill-primary",
  "fill-success",
  "fill-warning",
  "fill-info",
  "fill-destructive",
  "fill-secondary",
];

export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  className,
  centerLabel,
  centerValue,
  ariaLabel = "Donut chart",
}: DonutChartProps) {
  const total = Math.max(
    1,
    data.reduce((acc, d) => acc + d.value, 0),
  );
  const r = size / 2;
  const innerR = r - thickness;
  let angle = -Math.PI / 2;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel}
      >
        {data.map((d, i) => {
          const slice = (d.value / total) * Math.PI * 2;
          const a0 = angle;
          const a1 = angle + slice;
          angle = a1;
          const x0 = r + r * Math.cos(a0);
          const y0 = r + r * Math.sin(a0);
          const x1 = r + r * Math.cos(a1);
          const y1 = r + r * Math.sin(a1);
          const xi1 = r + innerR * Math.cos(a1);
          const yi1 = r + innerR * Math.sin(a1);
          const xi0 = r + innerR * Math.cos(a0);
          const yi0 = r + innerR * Math.sin(a0);
          const large = slice > Math.PI ? 1 : 0;
          const path = [
            `M ${x0} ${y0}`,
            `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
            `L ${xi1} ${yi1}`,
            `A ${innerR} ${innerR} 0 ${large} 0 ${xi0} ${yi0}`,
            "Z",
          ].join(" ");
          return <path key={i} d={path} className={d.colorClass ?? PALETTE[i % PALETTE.length]} />;
        })}
        {(centerValue || centerLabel) && (
          <g>
            <text
              x={r}
              y={r - 2}
              textAnchor="middle"
              className="fill-foreground font-display text-xl font-semibold tabular-nums"
            >
              {centerValue}
            </text>
            <text
              x={r}
              y={r + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] uppercase tracking-wide"
            >
              {centerLabel}
            </text>
          </g>
        )}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block size-3 rounded-sm",
                (d.colorClass ?? PALETTE[i % PALETTE.length]).replace("fill-", "bg-"),
              )}
              aria-hidden
            />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

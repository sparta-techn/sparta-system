import { cn } from "@/lib/utils";

interface HeatmapProps {
  /** rows × cols matrix of intensity values (0..max) */
  data: number[][];
  rowLabels: string[];
  colLabels: string[];
  max?: number;
  className?: string;
  ariaLabel?: string;
}

export function Heatmap({
  data,
  rowLabels,
  colLabels,
  max,
  className,
  ariaLabel = "Activity heatmap",
}: HeatmapProps) {
  const m = max ?? Math.max(1, ...data.flat());
  return (
    <div className={cn("overflow-x-auto", className)} role="img" aria-label={ariaLabel}>
      <table className="border-separate border-spacing-1 text-[11px] text-muted-foreground">
        <thead>
          <tr>
            <th aria-hidden />
            {colLabels.map((c) => (
              <th key={c} className="px-1 font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, r) => (
            <tr key={rowLabels[r]}>
              <th scope="row" className="pr-2 text-right font-medium text-foreground">
                {rowLabels[r]}
              </th>
              {row.map((v, c) => {
                const intensity = v / m;
                return (
                  <td key={c}>
                    <div
                      className="size-6 rounded-sm"
                      style={{
                        backgroundColor:
                          v === 0
                            ? "hsl(var(--muted))"
                            : `color-mix(in oklab, hsl(var(--primary)) ${20 + intensity * 70}%, transparent)`,
                      }}
                      title={`${rowLabels[r]} ${colLabels[c]}: ${v}`}
                      aria-label={`${rowLabels[r]} ${colLabels[c]} ${v}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useTasksState } from "@/features/tasks/store";
import { buildBurndown, sprintStats } from "../utils";
import type { Sprint } from "../types";

export function BurndownMock({ sprint }: { sprint: Sprint }) {
  const allTasks = useTasksState((s) => s.tasks);
  const tasks = useMemo(
    () => allTasks.filter((t) => t.sprintId === sprint.id && !t.parentTaskId && !t.deletedAt),
    [allTasks, sprint.id],
  );
  const stats = sprintStats(tasks);
  const series = buildBurndown(sprint, stats);

  const width = 600;
  const height = 220;
  const padX = 36;
  const padY = 24;
  const maxY = Math.max(...series.map((p) => p.ideal), stats.points || stats.total, 1);
  const maxX = series.length - 1 || 1;

  const x = (i: number) => padX + (i / maxX) * (width - padX * 2);
  const y = (v: number) => padY + (1 - v / maxY) * (height - padY * 2);

  const idealPath = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.ideal)}`).join(" ");
  const actualPoints = series.filter((p) => !Number.isNaN(p.actual));
  const actualPath = actualPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day)},${y(p.actual)}`)
    .join(" ");

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Burndown (mock)</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Placeholder visual — real velocity, burndown, and completion-rate analytics ship in a
            later milestone.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-muted-foreground/60" />
            Ideal
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-primary" />
            Actual
          </span>
        </div>
      </div>

      <div className="mt-4 w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full min-w-[480px]">
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line
              key={g}
              x1={padX}
              x2={width - padX}
              y1={padY + g * (height - padY * 2)}
              y2={padY + g * (height - padY * 2)}
              className="stroke-border"
              strokeDasharray="3 3"
            />
          ))}
          <path
            d={idealPath}
            fill="none"
            className="stroke-muted-foreground/60"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <path d={actualPath} fill="none" className="stroke-primary" strokeWidth={2} />
          <text x={padX} y={height - 4} className="fill-muted-foreground" fontSize="10">
            Day 0
          </text>
          <text
            x={width - padX - 24}
            y={height - 4}
            className="fill-muted-foreground"
            fontSize="10"
          >
            Day {maxX}
          </text>
        </svg>
      </div>
    </Card>
  );
}

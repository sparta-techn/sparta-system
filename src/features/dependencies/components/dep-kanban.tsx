import { useState } from "react";
import { cn } from "@/lib/utils";
import { dependencyStore } from "../store";
import {
  KANBAN_COLUMNS,
  STATE_LABEL,
  STATE_TONE,
  type Dependency,
  type DependencyState,
} from "../types";
import { DepCard } from "./dep-card";

const TONE_DOT: Record<string, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  primary: "bg-primary",
};

export function DepKanban({ items }: { items: Dependency[] }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<DependencyState | null>(null);

  const grouped = KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col] = items.filter((d) => d.state === col);
      return acc;
    },
    {} as Record<DependencyState, Dependency[]>,
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {KANBAN_COLUMNS.map((col) => (
          <section
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col);
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={() => {
              if (dragId) dependencyStore.setState(dragId, col);
              setDragId(null);
              setOverCol(null);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface/40 p-2 transition",
              overCol === col && "border-primary/50 bg-primary-soft/40",
            )}
            aria-label={`${STATE_LABEL[col]} column`}
          >
            <header className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", TONE_DOT[STATE_TONE[col]])} />
                <h3 className="text-sm font-semibold text-foreground">{STATE_LABEL[col]}</h3>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {grouped[col].length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-1">
              {grouped[col].length === 0 ? (
                <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground">
                  Drop here
                </div>
              ) : (
                grouped[col].map((d) => (
                  <DepCard
                    key={d.id}
                    dep={d}
                    draggable
                    onDragStart={(e) => {
                      setDragId(d.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

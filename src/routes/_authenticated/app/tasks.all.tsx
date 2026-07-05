import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGrid, List, Rows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TasksFilterBar } from "@/features/tasks/components/tasks-filter-bar";
import { TasksList } from "@/features/tasks/components/tasks-list";
import type { TaskFilters, TaskSort, TasksView } from "@/features/tasks/types";

export const Route = createFileRoute("/_authenticated/app/tasks/all")({
  head: () => ({ meta: [{ title: "All tasks · SpartaFlow Hub" }] }),
  component: AllTasksPage,
});

const VIEWS: { key: TasksView; label: string; icon: typeof List }[] = [
  { key: "list", label: "List", icon: List },
  { key: "table", label: "Table", icon: Rows },
  { key: "cards", label: "Cards", icon: LayoutGrid },
];

function AllTasksPage() {
  const [filters, setFilters] = useState<TaskFilters>({ topLevelOnly: true });
  const [sort, setSort] = useState<TaskSort>({ key: "updated", direction: "desc" });
  const [view, setView] = useState<TasksView>("list");

  return (
    <div className="space-y-4">
      <TasksFilterBar filters={filters} onChange={setFilters} sort={sort} onSortChange={setSort} />
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1 w-fit">
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <Button
              key={v.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setView(v.key)}
              className={cn("gap-1.5", active && "bg-muted text-foreground")}
            >
              <v.icon className="size-4" /> {v.label}
            </Button>
          );
        })}
      </div>
      <TasksList filters={filters} sort={sort} view={view} />
    </div>
  );
}

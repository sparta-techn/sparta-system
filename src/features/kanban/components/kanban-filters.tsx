import { Search, Settings2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { seedProjects } from "@/features/projects/mock-data";
import { employees } from "@/features/hr/mock-data";
import { PRIORITY_LABEL, TASK_PRIORITIES, type TaskPriority } from "@/features/tasks/types";
import { useTasksState } from "@/features/tasks/store";
import type { KanbanFilters } from "../types";

export function KanbanFiltersBar({
  filters,
  onChange,
  onOpenSettings,
}: {
  filters: KanbanFilters;
  onChange: (next: KanbanFilters) => void;
  onOpenSettings: () => void;
}) {
  const epics = useTasksState((s) => s.epics);
  const hasFilters =
    !!filters.search ||
    !!filters.projectIds?.length ||
    !!filters.assigneeIds?.length ||
    !!filters.priorities?.length ||
    !!filters.epicIds?.length;

  const toggle = <K extends keyof KanbanFilters>(
    key: K,
    value: string,
  ) => {
    const list = (filters[key] as string[] | undefined) ?? [];
    const next = list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
    onChange({ ...filters, [key]: next.length ? next : undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          placeholder="Search tasks…"
          className="h-9 pl-8"
        />
      </div>

      <FilterMenu
        label="Project"
        count={filters.projectIds?.length}
        items={seedProjects.map((p) => ({ id: p.id, label: `${p.icon} ${p.name}` }))}
        selected={filters.projectIds ?? []}
        onToggle={(id) => toggle("projectIds", id)}
      />
      <FilterMenu
        label="Assignee"
        count={filters.assigneeIds?.length}
        items={employees.map((e) => ({ id: e.id, label: e.name }))}
        selected={filters.assigneeIds ?? []}
        onToggle={(id) => toggle("assigneeIds", id)}
      />
      <FilterMenu
        label="Priority"
        count={filters.priorities?.length}
        items={TASK_PRIORITIES.map((p) => ({ id: p, label: PRIORITY_LABEL[p] }))}
        selected={(filters.priorities ?? []) as string[]}
        onToggle={(id) => toggle("priorities" as keyof KanbanFilters, id as TaskPriority)}
      />
      {epics.length ? (
        <FilterMenu
          label="Epic"
          count={filters.epicIds?.length}
          items={epics.map((e) => ({ id: e.id, label: e.name }))}
          selected={filters.epicIds ?? []}
          onToggle={(id) => toggle("epicIds", id)}
        />
      ) : null}

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({})} className="gap-1">
          <X className="size-3.5" /> Clear
        </Button>
      ) : null}

      <div className="ml-auto">
        <Button variant="outline" size="sm" onClick={onOpenSettings} className="gap-1.5">
          <Settings2 className="size-4" /> Board settings
        </Button>
      </div>
    </div>
  );
}

function FilterMenu({
  label,
  count,
  items,
  selected,
  onToggle,
}: {
  label: string;
  count?: number;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {label}
          {count ? (
            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
              {count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-56 overflow-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((i) => (
          <DropdownMenuCheckboxItem
            key={i.id}
            checked={selected.includes(i.id)}
            onCheckedChange={() => onToggle(i.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {i.label}
          </DropdownMenuCheckboxItem>
        ))}
        {!items.length ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No options</p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

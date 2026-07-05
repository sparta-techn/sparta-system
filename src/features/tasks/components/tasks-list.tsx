import { useCallback, useMemo, useState } from "react";
import { Archive, Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/features/hr/components/empty-state";
import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { applyFilters, bulkArchive, bulkDelete, bulkUpdate, useTasksState } from "../store";
import type { TaskFilters, TaskSort, TaskStatus, TasksView } from "../types";
import { STATUS_LABEL, TASK_STATUSES } from "../types";
import { TaskRow } from "./task-row";
import { TaskCard } from "./task-card";
import { TaskTableView } from "./task-table";

interface TasksListProps {
  filters: TaskFilters;
  sort: TaskSort;
  view: TasksView;
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
}

export function TasksList({
  filters,
  sort,
  view,
  showProject = true,
  emptyTitle = "No tasks match",
  emptyDescription = "Adjust filters or clear the search to see more.",
  loading,
}: TasksListProps) {
  const tasks = useTasksState((s) => s.tasks);
  const filtered = useMemo(() => applyFilters(tasks, filters, sort), [tasks, filters, sort]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Stable identity (functional update) so memoized TaskRow/TaskTableView rows
  // don't re-render just because a sibling's selection changed. Declared before
  // any early return so the hook order stays constant across renders.
  const toggle = useCallback((id: string, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      {selected.size ? (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onSetStatus={(s) => {
            bulkUpdate([...selected], { status: s });
            setSelected(new Set());
          }}
          onArchive={() => {
            bulkArchive([...selected]);
            setSelected(new Set());
          }}
          onDelete={() => {
            bulkDelete([...selected]);
            setSelected(new Set());
          }}
        />
      ) : null}

      {view === "list" ? (
        <div className="rounded-xl border bg-card">
          {filtered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              selected={selected.has(t.id)}
              onToggle={toggle}
              showProject={showProject}
            />
          ))}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      ) : (
        <TaskTableView tasks={filtered} selected={selected} onToggle={toggle} />
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} task{filtered.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function BulkBar({
  count,
  onClear,
  onSetStatus,
  onArchive,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onSetStatus: (s: TaskStatus) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <span className="font-medium">{count} selected</span>
      <span className="text-muted-foreground">·</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Set status
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TASK_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onClick={() => onSetStatus(s)}>
              {STATUS_LABEL[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="outline" onClick={onArchive}>
        <Archive className="size-4" /> Archive
      </Button>
      <Button size="sm" variant="outline" onClick={onDelete}>
        <Trash2 className="size-4" /> Delete
      </Button>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

export function TaskRowActionsMenu({
  onDuplicate,
  onArchive,
  onDelete,
}: {
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="size-4" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onArchive}>
          <Archive className="size-4" /> Archive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

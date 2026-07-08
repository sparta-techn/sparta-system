import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { applyFilters, useTasksState } from "../store";
import type { TaskFilters, TaskSort } from "../types";
import { TaskPriorityBadge, TaskStatusBadge } from "./badges";
import { EmployeeChip } from "./employee-chip";
import { formatDate, isOverdue, projectById } from "../utils";

const CURRENT_USER_ID = "emp_001";

function WidgetShell({
  title,
  href,
  count,
  children,
}: {
  title: string;
  href: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {count} item{count === 1 ? "" : "s"}
          </p>
        </div>
        <Link to={href} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

function CompactList({
  filters,
  sort,
  limit = 6,
}: {
  filters: TaskFilters;
  sort: TaskSort;
  limit?: number;
}) {
  const tasks = useTasksState((s) => applyFilters(s.tasks, filters, sort).slice(0, limit));

  if (!tasks.length) {
    return (
      <p className="rounded border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
        Nothing here right now.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {tasks.map((t) => {
        const overdue = isOverdue(t);
        const project = projectById(t.projectId);
        return (
          <li key={t.id} className="rounded border bg-card px-2.5 py-2">
            <div className="flex items-center gap-2">
              <Link
                to="/app/tasks/$id"
                params={{ id: t.id }}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{t.ref}</span>
                {t.title}
              </Link>
              <EmployeeChip id={t.assigneeId} showName={false} size="xs" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <TaskStatusBadge status={t.status} />
              <TaskPriorityBadge priority={t.priority} />
              {project ? (
                <span>
                  {project.icon} {project.name}
                </span>
              ) : null}
              {t.dueDate ? (
                <span className={cn(overdue && "text-destructive")}>
                  Due {formatDate(t.dueDate)}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MyTasksWidget() {
  const filters: TaskFilters = {
    assigneeIds: [CURRENT_USER_ID],
    status: ["todo", "in_progress", "review", "qa"],
  };
  const count = useTasksState((s) => applyFilters(s.tasks, filters).length);
  return (
    <WidgetShell title="My tasks" href="/app/tasks/all" count={count}>
      <CompactList filters={filters} sort={{ key: "priority", direction: "desc" }} />
    </WidgetShell>
  );
}

export function OverdueTasksWidget() {
  const filters: TaskFilters = { overdueOnly: true, topLevelOnly: true };
  const count = useTasksState((s) => applyFilters(s.tasks, filters).length);
  return (
    <WidgetShell title="Overdue" href="/app/tasks/all" count={count}>
      <CompactList filters={filters} sort={{ key: "due", direction: "asc" }} />
    </WidgetShell>
  );
}

export function TodayTasksWidget() {
  const tasks = useTasksState((s) => {
    const dayMs = 86_400_000;
    const tomorrow = Date.now() + dayMs;
    return s.tasks
      .filter((t) => {
        if (!t.dueDate || t.deletedAt || t.status === "done" || t.status === "cancelled")
          return false;
        const due = new Date(t.dueDate).getTime();
        return due >= Date.now() - dayMs && due < tomorrow;
      })
      .slice(0, 6);
  });

  return (
    <WidgetShell title="Today's tasks" href="/app/tasks/all" count={tasks.length}>
      {tasks.length === 0 ? (
        <p className="rounded border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
          Nothing due today. Plan tomorrow with focus.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded border bg-card px-2.5 py-2 text-sm"
            >
              <Link
                to="/app/tasks/$id"
                params={{ id: t.id }}
                className="min-w-0 flex-1 truncate hover:underline"
              >
                <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{t.ref}</span>
                {t.title}
              </Link>
              <TaskPriorityBadge priority={t.priority} />
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function RecentlyUpdatedWidget() {
  const filters: TaskFilters = { topLevelOnly: true };
  const count = useTasksState((s) => applyFilters(s.tasks, filters).length);
  return (
    <WidgetShell title="Recently updated" href="/app/tasks/all" count={count}>
      <CompactList filters={filters} sort={{ key: "updated", direction: "desc" }} />
    </WidgetShell>
  );
}

export function AssignedToMeWidget() {
  const filters: TaskFilters = { assigneeIds: [CURRENT_USER_ID] };
  const count = useTasksState((s) => applyFilters(s.tasks, filters).length);
  return (
    <WidgetShell title="Assigned to me" href="/app/tasks/all" count={count}>
      <CompactList filters={filters} sort={{ key: "updated", direction: "desc" }} />
    </WidgetShell>
  );
}

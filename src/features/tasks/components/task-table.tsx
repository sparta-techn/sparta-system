import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, isOverdue, projectById } from "../utils";
import type { Task } from "../types";
import { TaskPriorityBadge, TaskStatusBadge } from "./badges";
import { EmployeeChip } from "./employee-chip";

export function TaskTableView({
  tasks,
  selected,
  onToggle,
}: {
  tasks: Task[];
  selected: Set<string>;
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="w-24">Ref</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const project = projectById(t.projectId);
            const overdue = isOverdue(t);
            return (
              <TableRow key={t.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(t.id)}
                    onCheckedChange={(c) => onToggle(t.id, c === true)}
                    aria-label="Select task"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs uppercase text-muted-foreground">
                  {t.ref}
                </TableCell>
                <TableCell className="max-w-[360px]">
                  <Link
                    to="/app/tasks/$id"
                    params={{ id: t.id }}
                    className="line-clamp-1 font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={t.status} />
                </TableCell>
                <TableCell>
                  <TaskPriorityBadge priority={t.priority} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {project ? (
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden>{project.icon}</span> {project.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <EmployeeChip id={t.assigneeId} />
                </TableCell>
                <TableCell className={cn("text-xs", overdue && "text-destructive")}>
                  {formatDate(t.dueDate)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectHealth, ProjectPriority, ProjectStatus } from "../types";

const STATUS_STYLE: Record<ProjectStatus, { label: string; cls: string }> = {
  planning: {
    label: "Planning",
    cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  active: {
    label: "Active",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  on_hold: {
    label: "On hold",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  completed: {
    label: "Completed",
    cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
  archived: { label: "Archived", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: {
    label: "Cancelled",
    cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
};

const HEALTH_STYLE: Record<ProjectHealth, { label: string; cls: string }> = {
  healthy: {
    label: "Healthy",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  at_risk: {
    label: "At risk",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  blocked: {
    label: "Blocked",
    cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
  delayed: {
    label: "Delayed",
    cls: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  },
  completed: {
    label: "Completed",
    cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
};

const PRIORITY_STYLE: Record<ProjectPriority, { label: string; cls: string }> = {
  low: { label: "Low", cls: "bg-muted text-muted-foreground border-border" },
  medium: {
    label: "Medium",
    cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  high: {
    label: "High",
    cls: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  },
  critical: {
    label: "Critical",
    cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={cn("font-medium", s.cls)}>
      {s.label}
    </Badge>
  );
}
export function ProjectHealthBadge({ health }: { health: ProjectHealth }) {
  const s = HEALTH_STYLE[health];
  return (
    <Badge variant="outline" className={cn("font-medium", s.cls)}>
      {s.label}
    </Badge>
  );
}
export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <Badge variant="outline" className={cn("font-medium", s.cls)}>
      {s.label}
    </Badge>
  );
}

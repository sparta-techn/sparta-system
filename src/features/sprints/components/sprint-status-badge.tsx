import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SprintStatus } from "../types";

const LABEL: Record<SprintStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

const TONE: Record<SprintStatus, string> = {
  planned: "border-border bg-muted text-muted-foreground",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  completed: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export function SprintStatusBadge({ status, className }: { status: SprintStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE[status], className)}>
      {LABEL[status]}
    </Badge>
  );
}

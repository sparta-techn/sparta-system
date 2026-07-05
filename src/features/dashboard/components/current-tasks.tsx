import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { mockTasks, type MockTask } from "../mock-data";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<MockTask["priority"], "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

const STATUS_TONE: Record<MockTask["status"], "neutral" | "success" | "warning" | "danger" | "primary"> = {
  pending: "neutral",
  working: "primary",
  blocked: "danger",
  completed: "success",
};

export function CurrentTasks() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Current tasks</CardTitle>
          <CardDescription>
            Synced from ClickUp — the work assigned to you.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          View all <ExternalLink />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {mockTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: MockTask }) {
  return (
    <div
      className={cn(
        "group rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40",
        task.status === "completed" && "opacity-75",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {task.id}
            </span>
            <span className="text-xs text-muted-foreground">· {task.project}</span>
          </div>
          <p
            className={cn(
              "text-sm font-medium text-foreground",
              task.status === "completed" && "line-through",
            )}
          >
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={STATUS_TONE[task.status]}
              label={task.status.replace(/^./, (c) => c.toUpperCase())}
              size="sm"
            />
            <StatusBadge
              tone={PRIORITY_TONE[task.priority]}
              label={task.priority.toUpperCase()}
              size="sm"
              withDot={false}
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {task.deadline}
            </span>
          </div>
        </div>
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-primary-soft text-primary text-[10px] font-semibold">
            {task.assignee.initials}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={task.progress} className="h-1.5 flex-1" />
        <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">
          {task.progress}%
        </span>
      </div>
    </div>
  );
}

import {
  CheckCircle2,
  Coffee,
  LogIn,
  LogOut,
  MessageSquare,
  Play,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockActivity, type MockActivity } from "../mock-data";

const ICONS: Record<MockActivity["kind"], LucideIcon> = {
  clock_in: LogIn,
  task_started: Play,
  task_completed: CheckCircle2,
  dependency_created: Workflow,
  status_update: MessageSquare,
  break: Coffee,
  clock_out: LogOut,
};

const TONE: Record<MockActivity["kind"], string> = {
  clock_in: "bg-success-soft text-success",
  task_started: "bg-primary-soft text-primary",
  task_completed: "bg-success-soft text-success",
  dependency_created: "bg-info-soft text-info",
  status_update: "bg-muted text-foreground",
  break: "bg-info-soft text-info",
  clock_out: "bg-muted text-foreground",
};

export function ActivityTimeline() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Today's activity</CardTitle>
        <CardDescription>Your timeline so far.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 pl-6">
          <span className="absolute left-[11px] top-2 bottom-2 w-px bg-border" aria-hidden />
          {mockActivity.map((a) => {
            const Icon = ICONS[a.kind];
            return (
              <li key={a.id} className="relative">
                <span
                  className={`absolute -left-6 grid size-6 place-items-center rounded-full ring-4 ring-background ${TONE[a.kind]}`}
                  aria-hidden
                >
                  <Icon className="size-3" />
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{a.title}</span>
                    {a.detail ? <span className="text-muted-foreground"> · {a.detail}</span> : null}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {a.time}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

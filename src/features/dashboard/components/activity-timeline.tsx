import {
  Coffee,
  FileText,
  GitBranch,
  MessageSquare,
  Play,
  UserPlus,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { activityFeedRepository } from "@/repositories/activity";
import type { ActivitySource } from "@/services/activity";

const ICONS: Record<ActivitySource, LucideIcon> = {
  task: Play,
  dependency: Workflow,
  project: GitBranch,
  sprint: Play,
  report: FileText,
  membership: UserPlus,
  comment: MessageSquare,
};

const TONE: Record<ActivitySource, string> = {
  task: "bg-primary-soft text-primary",
  dependency: "bg-info-soft text-info",
  project: "bg-primary-soft text-primary",
  sprint: "bg-primary-soft text-primary",
  report: "bg-success-soft text-success",
  membership: "bg-muted text-foreground",
  comment: "bg-muted text-foreground",
};

// Coffee kept as a neutral fallback icon for unmapped source types.
const FALLBACK_ICON = Coffee;

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ActivityTimeline() {
  const userId = useAuth().user?.id ?? null;
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["activity", "actor", userId, "today"],
    queryFn: () => activityFeedRepository.forActor(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const today = rows.filter((r) => isToday(r.created_at));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Today's activity</CardTitle>
        <CardDescription>Your timeline so far.</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-sm text-muted-foreground">Couldn't load your activity.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your activity…</p>
        ) : today.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet today.</p>
        ) : (
          <ol className="relative space-y-4 pl-6">
            <span className="absolute left-[11px] top-2 bottom-2 w-px bg-border" aria-hidden />
            {today.map((a) => {
              const Icon = ICONS[a.source_type] ?? FALLBACK_ICON;
              const tone = TONE[a.source_type] ?? "bg-muted text-foreground";
              return (
                <li key={a.id} className="relative">
                  <span
                    className={`absolute -left-6 grid size-6 place-items-center rounded-full ring-4 ring-background ${tone}`}
                    aria-hidden
                  >
                    <Icon className="size-3" />
                  </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{a.summary}</span>
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatTime(a.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

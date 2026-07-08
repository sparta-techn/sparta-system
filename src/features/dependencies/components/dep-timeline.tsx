import {
  Check,
  CircleDot,
  GitMerge,
  MessageSquare,
  Pause,
  Pencil,
  Plus,
  UserPlus,
  X,
} from "lucide-react";
import { personById } from "../mock-data";
import { PRIORITY_LABEL, STATE_LABEL, type ActivityKind, type Dependency } from "../types";
import { timeAgo } from "../utils";

const ICONS: Record<ActivityKind, typeof Plus> = {
  created: Plus,
  accepted: Check,
  status_changed: GitMerge,
  priority_changed: Pencil,
  comment_added: MessageSquare,
  assigned: UserPlus,
  resolved: Check,
  closed: CircleDot,
  rejected: X,
  cancelled: Pause,
};

export function DepTimeline({ dep }: { dep: Dependency }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Activity</h2>
      <ol className="relative space-y-3 border-l border-border pl-5">
        {dep.activity.map((a) => {
          const Icon = ICONS[a.kind];
          const actor = personById(a.actorId);
          return (
            <li key={a.id} className="relative">
              <span
                className="absolute -left-[27px] top-0.5 grid size-5 place-items-center rounded-full bg-primary-soft text-primary ring-4 ring-background"
                aria-hidden
              >
                <Icon className="size-3" />
              </span>
              <p className="text-xs text-foreground">
                <span className="font-medium">{actor?.name ?? "Someone"}</span>{" "}
                {describe(a.kind, a.meta)}
              </p>
              <p className="text-[10px] text-muted-foreground">{timeAgo(a.at)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function describe(kind: ActivityKind, meta?: Record<string, string>): string {
  switch (kind) {
    case "created":
      return "created this dependency";
    case "accepted":
      return "accepted the request";
    case "status_changed":
      return `changed status ${meta?.from ? `from ${STATE_LABEL[meta.from as keyof typeof STATE_LABEL] ?? meta.from} ` : ""}to ${STATE_LABEL[meta?.to as keyof typeof STATE_LABEL] ?? meta?.to}`;
    case "priority_changed":
      return `changed priority ${meta?.from ? `from ${PRIORITY_LABEL[meta.from as keyof typeof PRIORITY_LABEL] ?? meta.from} ` : ""}to ${PRIORITY_LABEL[meta?.to as keyof typeof PRIORITY_LABEL] ?? meta?.to}`;
    case "comment_added":
      return "added a comment";
    case "assigned": {
      const owner = personById(meta?.to);
      return `assigned ${owner?.name ?? "owner"}`;
    }
    case "resolved":
      return "marked as resolved";
    case "closed":
      return "closed the dependency";
    case "rejected":
      return "rejected the request";
    case "cancelled":
      return "cancelled the request";
  }
}

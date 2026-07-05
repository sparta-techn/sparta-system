import { Link } from "@tanstack/react-router";
import { CalendarClock, MessageSquare, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { personById } from "../mock-data";
import type { Dependency } from "../types";
import { dueLabel, isOverdue } from "../utils";
import { PersonChip, PriorityPill, TypePill } from "./dep-badges";

export function DepCard({
  dep,
  draggable = false,
  onDragStart,
}: {
  dep: Dependency;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const owner = personById(dep.ownerId);
  const overdue = isOverdue(dep);
  return (
    <Link
      to="/app/dependencies/$id"
      params={{ id: dep.id }}
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "block rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-mono text-muted-foreground">{dep.id}</p>
        <PriorityPill priority={dep.priority} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{dep.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TypePill type={dep.type} />
        <span className="text-[10px] text-muted-foreground">· {dep.project}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {owner ? (
          <PersonChip name={owner.name} color={owner.avatarColor} sub={owner.department} />
        ) : (
          <span className="text-[11px] italic text-muted-foreground">Unassigned</span>
        )}
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          {dep.comments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" />
              {dep.comments.length}
            </span>
          )}
          {dep.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3" />
              {dep.attachments.length}
            </span>
          )}
          {dep.dueAt && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive")}>
              <CalendarClock className="size-3" />
              {dueLabel(dep)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

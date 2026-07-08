import { Link } from "@tanstack/react-router";
import { Archive, ArrowRight, CheckCheck, Inbox, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { getCurrentUserId } from "../directory";
import { notificationStore, useMinuteTick, useNotifications, useUnreadCount } from "../store";
import { BUCKET_LABEL, bucketOf, formatRelative, iconFor, toneClass } from "../ui";
import type { AppNotification } from "../types";

export function NotificationDropdown({ trigger }: { trigger: React.ReactNode }) {
  const userId = getCurrentUserId();
  useMinuteTick();
  const all = useNotifications(userId);
  const unread = useUnreadCount(userId);
  const visible = all.filter((n) => !n.archivedAt).slice(0, 12);

  const grouped: Record<string, AppNotification[]> = { today: [], yesterday: [], earlier: [] };
  for (const n of visible) grouped[bucketOf(n.createdAt)].push(n);

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(380px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "You're all caught up."}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={unread === 0}
              onClick={() => notificationStore.markAllRead(userId)}
            >
              <CheckCheck className="size-3" /> Mark all
            </Button>
            <Button variant="ghost" size="icon" className="size-7" asChild aria-label="Preferences">
              <Link to="/app/notifications/preferences">
                <Settings2 className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        <Separator />
        <ScrollArea className="max-h-[60vh]">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Inbox className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground">
                We'll surface mentions, blockers and reminders here.
              </p>
            </div>
          ) : (
            (["today", "yesterday", "earlier"] as const).map((b) =>
              grouped[b].length === 0 ? null : (
                <div key={b} className="py-1">
                  <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {BUCKET_LABEL[b]}
                  </p>
                  {grouped[b].map((n) => (
                    <NotificationRow key={n.id} n={n} compact />
                  ))}
                </div>
              ),
            )
          )}
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" asChild className="w-full justify-between">
            <Link to="/app/notifications">
              Open notification center <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationRow({
  n,
  compact = false,
  onAction,
}: {
  n: AppNotification;
  compact?: boolean;
  onAction?: (kind: "read" | "archive" | "delete") => void;
}) {
  const Icon = iconFor(n);
  const unread = !n.readAt;

  function handleOpen() {
    if (unread) notificationStore.markRead(n.id);
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50",
        unread && "bg-primary-soft/30",
      )}
    >
      <div
        className={cn("grid size-8 shrink-0 place-items-center rounded-full", toneClass(n.type))}
        aria-hidden
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {formatRelative(n.createdAt)}
          </span>
        </div>
        <p className={cn("text-xs text-muted-foreground", compact ? "line-clamp-2" : "")}>
          {n.body}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          {n.href ? (
            <Button
              asChild
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px]"
              onClick={handleOpen}
            >
              <Link to={n.href as never}>Open</Link>
            </Button>
          ) : null}
          {!compact ? (
            <>
              {unread ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    notificationStore.markRead(n.id);
                    onAction?.("read");
                  }}
                >
                  Mark read
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  notificationStore.archive(n.id);
                  onAction?.("archive");
                }}
              >
                <Archive className="size-3" /> Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                onClick={() => {
                  notificationStore.remove(n.id);
                  onAction?.("delete");
                }}
              >
                <Trash2 className="size-3" /> Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {unread ? (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
      ) : null}
    </div>
  );
}

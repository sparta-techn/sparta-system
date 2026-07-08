import { Bell, Moon, Search, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";

import { getCurrentUserId } from "@/features/notifications/directory";
import { useNotificationBootstrap } from "@/features/notifications/bootstrap";
import { NotificationDropdown } from "@/features/notifications/components/notification-dropdown";
import { useUnreadCount } from "@/features/notifications/store";

export function Topbar() {
  const { resolvedTheme, toggle } = useTheme();
  useNotificationBootstrap();
  const unread = useUnreadCount(getCurrentUserId());

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger className="size-9" />
      <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
      <div className="relative flex-1 max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search people, dependencies, reports…"
          aria-label="Search"
          className="h-9 pl-9 bg-surface"
        />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={toggle}
          className="size-9"
        >
          {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <NotificationDropdown
          trigger={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
              className="size-9 relative"
            >
              <Bell className="size-4" />
              {unread > 0 ? (
                <span
                  className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums h-[18px]"
                  aria-hidden
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Button>
          }
        />
        <Avatar className="size-8 ml-1">
          <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
            KA
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

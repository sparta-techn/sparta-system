import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  GaugeCircle,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Settings,
  ShieldCheck,
  ShieldHalf,
  Sparkles,
  Target,
  Users,
  Workflow,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FuturePlanBadge } from "@/components/future-plan";
import { isFeatureInMvp } from "@/config/mvp-scope";
import { useAuth } from "@/features/auth/auth-context";

type NavItem = {
  /** Matches an id in `src/config/mvp-scope.ts` to resolve MVP scope. */
  id: string;
  title: string;
  url: string;
  icon: typeof Home;
  /**
   * How to surface this item when its feature is out of MVP scope.
   * "hide" (default) drops it; "future" renders it disabled with a badge.
   */
  whenOutOfMvp?: "hide" | "future";
};

const PRIMARY: NavItem[] = [
  { id: "dashboard", title: "Dashboard", url: "/app", icon: Home },
  { id: "check-in", title: "Check-in", url: "/app/check-in", icon: Sparkles },
  { id: "midday", title: "Midday", url: "/app/midday", icon: GaugeCircle },
  { id: "eod", title: "End-of-day", url: "/app/eod", icon: ClipboardCheck },
  { id: "attendance", title: "Attendance", url: "/app/attendance", icon: Calendar },
  {
    id: "workflow",
    title: "Workflow",
    url: "/app/workflow",
    icon: ClipboardList,
    whenOutOfMvp: "hide",
  },
  {
    id: "dependencies",
    title: "Dependencies",
    url: "/app/dependencies",
    icon: Workflow,
    whenOutOfMvp: "future",
  },
  { id: "projects", title: "Projects", url: "/app/projects", icon: Briefcase },
  { id: "tasks", title: "Tasks", url: "/app/tasks", icon: CheckSquare },
  { id: "sprints", title: "Sprints", url: "/app/sprints", icon: Target, whenOutOfMvp: "future" },
  {
    id: "announcements",
    title: "Announcements",
    url: "/app/announcements",
    icon: Megaphone,
    whenOutOfMvp: "hide",
  },
  { id: "notifications", title: "Notifications", url: "/app/notifications", icon: Bell },
];

const TEAM: NavItem[] = [
  {
    id: "executive",
    title: "Executive",
    url: "/app/executive",
    icon: Gauge,
    whenOutOfMvp: "future",
  },
  { id: "manager", title: "Manager", url: "/app/manager", icon: LayoutDashboard },
  { id: "report-review", title: "Report reviews", url: "/app/report-review", icon: ClipboardList },
  { id: "hr", title: "HR workspace", url: "/app/hr", icon: HeartHandshake },
  { id: "directory", title: "Directory", url: "/app/hr/employees", icon: Users },
  {
    id: "analytics",
    title: "Analytics",
    url: "/app/analytics",
    icon: BarChart3,
    whenOutOfMvp: "future",
  },
  { id: "audit", title: "Audit log", url: "/app/audit", icon: ShieldCheck, whenOutOfMvp: "future" },
  { id: "admin", title: "Admin Console", url: "/app/admin", icon: ShieldHalf },
];

const SYSTEM: NavItem[] = [
  { id: "settings", title: "Settings", url: "/settings", icon: Settings },
  { id: "help", title: "Help", url: "/help", icon: LifeBuoy },
];

function SectionMenu({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
}) {
  // Out-of-MVP items are hidden unless they opt into the "future" display.
  const visible = items.filter((item) => isFeatureInMvp(item.id) || item.whenOutOfMvp === "future");
  if (visible.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => {
            // Deferred feature: visibly disabled with a "Future Plan" badge.
            if (!isFeatureInMvp(item.id)) {
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton disabled tooltip="Planned for a future release">
                    <item.icon className="size-4" aria-hidden />
                    <span>{item.title}</span>
                    <FuturePlanBadge className="ml-auto" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            const isActive =
              item.url === "/"
                ? currentPath === "/"
                : currentPath === item.url || currentPath.startsWith(`${item.url}/`);
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <Link to={item.url as never} className="flex items-center gap-2">
                    <item.icon className="size-4" aria-hidden />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  });
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Reuse the shared auth-context sign-out (records the audit event, calls
  // supabase.auth.signOut(), and clears local state), then leave the protected
  // area so the session is actually terminated — not just hidden.
  const handleLogout = async () => {
    await signOut();
    await navigate({ to: "/auth" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-display font-bold"
            aria-hidden
          >
            S
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">SpartaFlow</p>
            <p className="truncate text-[11px] text-muted-foreground">Operations Hub</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SectionMenu label="Workspace" items={PRIMARY} currentPath={currentPath} />
        <SectionMenu label="Team" items={TEAM} currentPath={currentPath} />
        <SectionMenu label="System" items={SYSTEM} currentPath={currentPath} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Log out">
              <LogOut className="size-4" aria-hidden />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-3 py-2 text-[11px] text-muted-foreground">v0.1 · Design preview</p>
      </SidebarFooter>
    </Sidebar>
  );
}

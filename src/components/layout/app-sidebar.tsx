import { Link, useRouterState } from "@tanstack/react-router";
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

const PRIMARY = [
  { title: "Dashboard", url: "/app", icon: Home },
  { title: "Check-in", url: "/app/check-in", icon: Sparkles },
  { title: "Midday", url: "/app/midday", icon: GaugeCircle },
  { title: "End-of-day", url: "/app/eod", icon: ClipboardCheck },
  { title: "Attendance", url: "/app/attendance", icon: Calendar },
  { title: "Workflow", url: "/app/workflow", icon: ClipboardList },
  { title: "Dependencies", url: "/app/dependencies", icon: Workflow },
  { title: "Projects", url: "/app/projects", icon: Briefcase },
  { title: "Tasks", url: "/app/tasks", icon: CheckSquare },
  { title: "Sprints", url: "/app/sprints", icon: Target },
  { title: "Announcements", url: "/app/announcements", icon: Megaphone },
  { title: "Notifications", url: "/app/notifications", icon: Bell },
];

const TEAM = [
  { title: "Executive", url: "/app/executive", icon: Gauge },
  { title: "Manager", url: "/app/manager", icon: LayoutDashboard },
  { title: "HR workspace", url: "/app/hr", icon: HeartHandshake },
  { title: "Directory", url: "/app/hr/employees", icon: Users },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
  { title: "Audit log", url: "/app/audit", icon: ShieldCheck },
  { title: "Admin Console", url: "/app/admin", icon: ShieldHalf },
];

const SYSTEM = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help", url: "/help", icon: LifeBuoy },
];

function SectionMenu({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: { title: string; url: string; icon: typeof Home }[];
  currentPath: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              item.url === "/"
                ? currentPath === "/"
                : currentPath === item.url || currentPath.startsWith(`${item.url}/`);
            return (
              <SidebarMenuItem key={item.title}>
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
        <p className="px-3 py-2 text-[11px] text-muted-foreground">v0.1 · Design preview</p>
      </SidebarFooter>
    </Sidebar>
  );
}

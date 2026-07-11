import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

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
import { orgQueries } from "@/features/admin/organization-queries";
import { useAuth } from "@/features/auth/auth-context";
import {
  isNavItemDeferred,
  isNavItemVisible,
  PRIMARY_NAV,
  SYSTEM_NAV,
  TEAM_NAV,
  type NavItem,
} from "./nav-config";

function SectionMenu({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
}) {
  const { roles } = useAuth();
  // Filter by MVP scope *and* the current user's roles (see nav-config).
  const visible = items.filter((item) => isNavItemVisible(item, roles));
  if (visible.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => {
            // Deferred feature: visibly disabled with a "Future Plan" badge.
            if (isNavItemDeferred(item)) {
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
  const { data: company } = useQuery(orgQueries.company());
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
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt=""
              className="size-8 shrink-0 rounded-lg object-contain"
              aria-hidden
            />
          ) : (
            <div
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-display font-bold"
              aria-hidden
            >
              S
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">SpartaFlow</p>
            <p className="truncate text-[11px] text-muted-foreground">Operations Hub</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SectionMenu label="Workspace" items={PRIMARY_NAV} currentPath={currentPath} />
        <SectionMenu label="Team" items={TEAM_NAV} currentPath={currentPath} />
        <SectionMenu label="System" items={SYSTEM_NAV} currentPath={currentPath} />
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

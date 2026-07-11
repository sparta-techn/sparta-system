import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { FaviconManager } from "./favicon-manager";
import { Topbar } from "./topbar";
import { FloatingActiveTimer } from "@/features/time-tracking/components/floating-active-timer";
import { ErrorBoundary } from "@/components/error-boundary";
import { MaintenanceBanner } from "@/features/admin/components/maintenance-banner";
import { useAuth } from "@/features/auth/auth-context";

interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell — application-level layout chrome.
 * Composes Sidebar + Topbar around a <main> region that hosts route content.
 * Use this in any authenticated layout route.
 */
export function AppShell({ children }: AppShellProps) {
  const { hasAnyRole } = useAuth();
  // The floating timer is a personal time-tracker for people who do the daily
  // work; company leadership (owner/admin) don't clock their own time, so it's
  // hidden for them — consistent with hiding check-in/midday/eod in the nav.
  const isLeadership = hasAnyRole(["owner", "admin"]);

  return (
    <SidebarProvider>
      <FaviconManager />
      <AppSidebar />
      <SidebarInset className="bg-background">
        <Topbar />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8" tabIndex={-1}>
          {/* Isolate page content: a feature crash degrades to a fallback while
              the sidebar/topbar stay usable for navigation and recovery. */}
          <ErrorBoundary variant="inline" context={{ boundary: "app_shell" }}>
            <MaintenanceBanner />
            {children}
          </ErrorBoundary>
        </main>
      </SidebarInset>
      {!isLeadership ? <FloatingActiveTimer /> : null}
    </SidebarProvider>
  );
}

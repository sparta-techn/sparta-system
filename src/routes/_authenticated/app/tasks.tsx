import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreateTaskDialog } from "@/features/tasks/components/create-task-dialog";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/tasks")({
  staticData: routeGuard({ permissions: ["tasks.read"] }),
  head: () => ({ meta: [{ title: "Tasks · SpartaFlow Hub" }] }),
  component: TasksLayout,
});

const TABS = [
  { label: "Overview", to: "/app/tasks" },
  { label: "All tasks", to: "/app/tasks/all" },
  { label: "Kanban", to: "/app/tasks/kanban" },
  { label: "My time", to: "/app/tasks/time" },
] as const;

function TasksLayout() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell>
      <PageHeader
        eyebrow="Delivery"
        title="Tasks"
        description="Every unit of work, from quick fixes to multi-week initiatives."
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New task
          </Button>
        }
      />
      <nav className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => {
          const active = t.to === "/app/tasks" ? path === t.to : path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
      <CreateTaskDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

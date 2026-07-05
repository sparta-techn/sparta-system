import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectsSubnav } from "@/features/projects/components/projects-subnav";
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import { routeGuard } from "@/features/auth/route-guard";

export const Route = createFileRoute("/_authenticated/app/projects")({
  staticData: routeGuard({ permissions: ["projects.read"] }),
  head: () => ({ meta: [{ title: "Projects · SpartaFlow Hub" }] }),
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const [open, setOpen] = useState(false);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description="Workspaces for every active engagement — from kickoff to handover."
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New project
          </Button>
        }
      />
      <ProjectsSubnav />
      <Outlet />
      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

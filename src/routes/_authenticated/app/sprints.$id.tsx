import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Play, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deleteSprint,
  setSprintStatus,
  useSprintsState,
} from "@/features/sprints/store";
import { SprintOverview } from "@/features/sprints/components/sprint-overview";
import { SprintTasks } from "@/features/sprints/components/sprint-tasks";
import { SprintProgress } from "@/features/sprints/components/sprint-progress";
import { SprintReports } from "@/features/sprints/components/sprint-reports";
import { SprintPlanningBoard } from "@/features/sprints/components/sprint-planning-board";
import { SprintStatusBadge } from "@/features/sprints/components/sprint-status-badge";

export const Route = createFileRoute("/_authenticated/app/sprints/$id")({
  head: () => ({ meta: [{ title: "Sprint · SpartaFlow Hub" }] }),
  component: SprintDetail,
});

function SprintDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const sprint = useSprintsState((s) => s.sprints.find((sp) => sp.id === id));
  const [tab, setTab] = useState("overview");

  if (!sprint) {
    return (
      <AppShell>
        <PageHeader eyebrow="Delivery" title="Sprint not found" />
        <Card className="p-10 text-center text-sm text-muted-foreground">
          This sprint may have been removed.
          <div className="mt-3">
            <Link to="/app/sprints" className="text-primary underline-offset-4 hover:underline">
              Back to sprints
            </Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  const current = sprint;
  function advance() {
    if (current.status === "planned") setSprintStatus(current.id, "active");
    else if (current.status === "active") setSprintStatus(current.id, "completed");
  }

  return (
    <AppShell>
      <div className="mb-2 flex items-center gap-3">
        <Link
          to="/app/sprints"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> All sprints
        </Link>
        <SprintStatusBadge status={sprint.status} />
      </div>

      <PageHeader
        eyebrow="Delivery"
        title={sprint.name}
        description={sprint.goal || "No sprint goal defined."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {sprint.status === "planned" ? (
              <Button className="gap-2" onClick={advance}>
                <Play className="size-4" /> Start sprint
              </Button>
            ) : null}
            {sprint.status === "active" ? (
              <Button className="gap-2" onClick={advance}>
                <CheckCircle2 className="size-4" /> Complete sprint
              </Button>
            ) : null}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Delete sprint">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this sprint?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tasks in this sprint will be detached and returned to the project backlog. Tasks themselves are not deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteSprint(sprint.id);
                      navigate({ to: "/app/sprints" });
                    }}
                  >
                    Delete sprint
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <SprintOverview sprint={sprint} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-0">
          <SprintTasks sprint={sprint} />
        </TabsContent>
        <TabsContent value="planning" className="mt-0">
          <SprintPlanningBoard sprint={sprint} />
        </TabsContent>
        <TabsContent value="progress" className="mt-0">
          <SprintProgress sprint={sprint} />
        </TabsContent>
        <TabsContent value="reports" className="mt-0">
          <SprintReports sprint={sprint} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectsState, toggleFavorite } from "../store";
import { cn } from "@/lib/utils";
import { ProjectHealthBadge, ProjectPriorityBadge, ProjectStatusBadge } from "./badges";
import { ProjectDashboard } from "./project-dashboard";
import { ProjectOverview } from "./project-overview";
import { ProjectMembers } from "./project-members";
import { ProjectFiles, ProjectActivity, ProjectReports } from "./project-extras";
import { ProjectSettingsTab } from "./project-settings-tab";
import { ProjectTimeSummary } from "@/features/time-tracking/components/project-time-summary";
import { ProjectAnalyticsDashboard } from "@/features/project-analytics/components/project-analytics-dashboard";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const project = useProjectsState((s) => s.projects.find((p) => p.id === projectId) ?? null);
  const navigate = useNavigate();

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/projects/all" })}>
          <ArrowLeft className="size-4" /> Back to projects
        </Button>
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="font-medium">Project not found</p>
          <p className="text-sm text-muted-foreground">
            It may have been deleted or you don't have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/projects/all">
            <ArrowLeft className="size-4" /> All projects
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {project.repositoryUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="gap-1.5">
                Repository <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleFavorite(project.id)}
            aria-label="Favorite"
          >
            <Star
              className={cn("size-4", project.favorite ? "fill-amber-400 text-amber-500" : "")}
            />
          </Button>
        </div>
      </div>

      <div
        className="rounded-xl border bg-card p-5"
        style={{ background: `linear-gradient(135deg, ${project.color}14, transparent 60%)` }}
      >
        <div className="flex items-start gap-4">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-xl text-3xl"
            style={{ background: `${project.color}22`, color: project.color }}
            aria-hidden
          >
            {project.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{project.name}</h1>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs uppercase text-muted-foreground">
                {project.key}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-muted-foreground">
              {project.description || "No description yet."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <ProjectStatusBadge status={project.status} />
              <ProjectHealthBadge health={project.health} />
              <ProjectPriorityBadge priority={project.priority} />
              <span className="text-xs text-muted-foreground">
                · {new Date(project.startDate).toLocaleDateString()} →{" "}
                {new Date(project.endDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks" disabled>
            Tasks
          </TabsTrigger>
          <TabsTrigger value="milestones" disabled>
            Milestones
          </TabsTrigger>
          <TabsTrigger value="epics" disabled>
            Epics
          </TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <ProjectDashboard projectId={project.id} />
        </TabsContent>
        <TabsContent value="overview" className="mt-4">
          <ProjectOverview project={project} />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <ProjectFiles project={project} />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <ProjectMembers project={project} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ProjectReports project={project} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <ProjectAnalyticsDashboard projectId={project.id} />
        </TabsContent>
        <TabsContent value="time" className="mt-4">
          <ProjectTimeSummary projectId={project.id} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ProjectActivity project={project} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <ProjectSettingsTab project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

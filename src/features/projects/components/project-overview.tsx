import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  GitBranch,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { EmployeeAvatar } from "@/features/hr/components/employee-avatar";
import { activityFor, filesFor, getClient, milestonesFor, personById } from "../store";
import type { Milestone, Project } from "../types";

export function ProjectOverview({ project }: { project: Project }) {
  const client = project.clientId ? getClient(project.clientId) : null;
  const manager = personById(project.managerId);
  const milestones = milestonesFor(project.id);
  const activity = activityFor(project.id).slice(0, 6);
  const files = filesFor(project.id).slice(0, 3);
  const upcoming = milestones.filter((m) => m.status !== "done").slice(0, 4);

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>Overall completion</span>
                <span className="font-medium tabular-nums">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Open" value={project.openTasks} icon={Clock} />
              <StatCard label="Completed" value={project.completedTasks} icon={CheckCircle2} />
              <StatCard
                label="Overdue"
                value={project.overdueTasks}
                icon={AlertTriangle}
                trend={
                  project.overdueTasks > 0
                    ? { direction: "up", value: `${project.overdueTasks} late`, intent: "negative" }
                    : undefined
                }
              />
              <StatCard label="Dependencies" value={project.openDependencies} icon={GitBranch} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">All milestones completed.</p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((m) => (
                  <MilestoneRow key={m.id} milestone={m} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => {
                  const emp = personById(a.actorId);
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      {emp ? <EmployeeAvatar employee={emp} size={28} /> : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{emp?.name ?? "Someone"}</span> ·{" "}
                          {a.summary}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Project manager">
              {manager ? (
                <div className="flex items-center gap-2">
                  <EmployeeAvatar employee={manager} size={24} />
                  <span>{manager.name}</span>
                </div>
              ) : (
                "—"
              )}
            </Info>
            <Info label="Client">{client?.company ?? "Internal"}</Info>
            <Info label="Department">{project.department}</Info>
            <Info label="Timeline">
              {new Date(project.startDate).toLocaleDateString()} →{" "}
              {new Date(project.endDate).toLocaleDateString()}
            </Info>
            <Info label="Members">{project.members.length}</Info>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ResourceLink label="Repository" href={project.repositoryUrl} />
            <ResourceLink label="Designs" href={project.figmaUrl} />
            <ResourceLink label="API documentation" href={project.apiDocsUrl} />
            {project.environments.map((env) => (
              <ResourceLink key={env.label} label={env.label} href={env.url} />
            ))}
            {!project.repositoryUrl &&
            !project.figmaUrl &&
            !project.apiDocsUrl &&
            project.environments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No resources linked. Add them from project settings.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent files</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files yet.</p>
            ) : (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ResourceLink({ label, href }: { label: string; href?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 hover:bg-muted/40"
    >
      <span>{label}</span>
      <ExternalLink className="size-3.5 text-muted-foreground" />
    </a>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const dot =
    milestone.status === "done"
      ? "bg-emerald-500"
      : milestone.status === "in_progress"
        ? "bg-amber-500"
        : milestone.status === "missed"
          ? "bg-rose-500"
          : "bg-muted-foreground/40";
  return (
    <li className="flex items-center gap-3 py-2">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      <span className="flex-1 text-sm">{milestone.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{milestone.progress}%</span>
      <span className="w-24 text-right text-xs text-muted-foreground">
        {new Date(milestone.dueDate).toLocaleDateString()}
      </span>
    </li>
  );
}

import { Link } from "@tanstack/react-router";
import { Star, MoreHorizontal, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmployeeAvatar } from "@/features/hr/components/employee-avatar";
import { cn } from "@/lib/utils";
import { ProjectHealthBadge, ProjectPriorityBadge, ProjectStatusBadge } from "./badges";
import { personById, toggleFavorite } from "../store";
import type { Project } from "../types";

export function ProjectCard({ project }: { project: Project }) {
  const manager = personById(project.managerId);
  return (
    <Card className="group flex h-full flex-col overflow-hidden">
      <div
        className="relative px-4 pt-4 pb-3"
        style={{ background: `linear-gradient(135deg, ${project.color}18, transparent)` }}
      >
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/app/projects/$id"
            params={{ id: project.id }}
            className="flex min-w-0 items-center gap-2"
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-lg text-xl shadow-sm"
              style={{ background: `${project.color}22`, color: project.color }}
              aria-hidden
            >
              {project.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold">{project.name}</p>
              <p className="text-xs font-mono uppercase text-muted-foreground">{project.key}</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite(project.id);
            }}
            aria-label={project.favorite ? "Unfavorite" : "Favorite"}
          >
            <Star
              className={cn(
                "size-4",
                project.favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
              )}
            />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-4 pb-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {project.description || "No description yet."}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <ProjectStatusBadge status={project.status} />
          <ProjectHealthBadge health={project.health} />
          <ProjectPriorityBadge priority={project.priority} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="tabular-nums font-medium text-foreground">{project.progress}%</span>
          </div>
          <Progress value={project.progress} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Open" value={project.openTasks} />
          <Stat label="Done" value={project.completedTasks} />
          <Stat
            label="Overdue"
            value={project.overdueTasks}
            tone={project.overdueTasks > 0 ? "danger" : undefined}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex -space-x-2">
            {project.members.slice(0, 4).map((m) => {
              const emp = personById(m.employeeId);
              if (!emp) return null;
              return (
                <div key={m.employeeId} className="ring-2 ring-card rounded-full">
                  <EmployeeAvatar employee={emp} size={24} />
                </div>
              );
            })}
            {project.members.length > 4 ? (
              <div className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card">
                +{project.members.length - 4}
              </div>
            ) : null}
          </div>
          {manager ? (
            <p className="truncate text-xs text-muted-foreground">
              PM · {manager.name.split(" ")[0]}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular-nums font-semibold", tone === "danger" && "text-destructive")}>
        {value}
      </p>
    </div>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const manager = personById(project.managerId);
  return (
    <Link
      to="/app/projects/$id"
      params={{ id: project.id }}
      className="grid grid-cols-[1.6fr_1fr_1fr_1fr_140px_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg text-lg"
          style={{ background: `${project.color}22`, color: project.color }}
          aria-hidden
        >
          {project.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-xs font-mono uppercase text-muted-foreground">{project.key}</p>
        </div>
      </div>
      <div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div>
        <ProjectHealthBadge health={project.health} />
      </div>
      <div className="text-sm text-muted-foreground truncate">{manager?.name ?? "—"}</div>
      <div className="space-y-1">
        <Progress value={project.progress} className="h-1.5" />
        <p className="text-[11px] text-muted-foreground tabular-nums">{project.progress}%</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          toggleFavorite(project.id);
        }}
        aria-label="Toggle favorite"
      >
        <Star
          className={cn(
            "size-4",
            project.favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
          )}
        />
      </Button>
    </Link>
  );
}

export function ExternalLinkChip({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 text-xs hover:bg-muted"
    >
      {label}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

// Re-export for convenience
export { MoreHorizontal };

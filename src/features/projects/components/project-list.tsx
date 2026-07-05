import { useMemo, useState } from "react";
import { Grid3x3, List, Plus, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listClients, useProjectsState } from "../store";
import { ProjectCard, ProjectRow } from "./project-card";
import { CreateProjectDialog } from "./create-project-dialog";
import type { Project, ProjectStatus } from "../types";

type View = "grid" | "list";
type Sort = "recent" | "name" | "progress" | "health";

export function ProjectList() {
  const projects = useProjectsState((s) => s.projects);
  const clients = useMemo(() => listClients(), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<View>("grid");
  const [favOnly, setFavOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = projects.filter((p) => {
      if (!includeArchived && p.status === "archived") return false;
      if (favOnly && !p.favorite) return false;
      if (status !== "all" && p.status !== status) return false;
      if (clientId !== "all" && p.clientId !== clientId) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !p.name.toLowerCase().includes(s) &&
          !p.key.toLowerCase().includes(s) &&
          !p.description.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "progress":
          return b.progress - a.progress;
        case "health":
          return HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return list;
  }, [projects, q, status, clientId, sort, favOnly, includeArchived]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects by name, key, or description"
            className="pl-8"
            aria-label="Search projects"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(
              ["planning", "active", "on_hold", "completed", "cancelled"] satisfies ProjectStatus[]
            ).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-[170px]" aria-label="Client">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-[150px]" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
            <SelectItem value="health">Health</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={favOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFavOnly((v) => !v)}
          className="gap-1.5"
        >
          <Star className={cn("size-4", favOnly && "fill-current")} />
          Favorites
        </Button>
        <Button
          variant={includeArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setIncludeArchived((v) => !v)}
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </Button>
        <div className="flex items-center rounded-md border">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn("p-2", view === "grid" && "bg-muted")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
          >
            <Grid3x3 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn("p-2 border-l", view === "list" && "bg-muted")}
            aria-label="List view"
            aria-pressed={view === "list"}
          >
            <List className="size-4" />
          </button>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="font-medium">No projects match your filters</p>
          <p className="text-sm text-muted-foreground">Try clearing search or filters.</p>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_140px_auto] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Project</span>
            <span>Status</span>
            <span>Health</span>
            <span>Manager</span>
            <span>Progress</span>
            <span className="sr-only">Actions</span>
          </div>
          <div className="divide-y">
            {filtered.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} project{filtered.length === 1 ? "" : "s"}
      </p>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

const HEALTH_RANK: Record<Project["health"], number> = {
  blocked: 0,
  delayed: 1,
  at_risk: 2,
  healthy: 3,
  completed: 4,
};

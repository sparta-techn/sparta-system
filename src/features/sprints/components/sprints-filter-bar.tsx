import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useProjectsState } from "@/features/projects/store";
import type { SprintFilters, SprintStatus } from "../types";

const STATUS_OPTIONS: Array<{ value: SprintStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export function SprintsFilterBar({
  value,
  onChange,
}: {
  value: SprintFilters;
  onChange: (next: SprintFilters) => void;
}) {
  const projects = useProjectsState((s) => s.projects);
  const status = value.statuses?.[0] ?? "all";
  const project = value.projectIds?.[0] ?? "all";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Search sprints…"
          className="pl-8"
        />
      </div>

      <Select
        value={project}
        onValueChange={(v) => onChange({ ...value, projectIds: v === "all" ? undefined : [v] })}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={status}
        onValueChange={(v) =>
          onChange({ ...value, statuses: v === "all" ? undefined : [v as SprintStatus] })
        }
      >
        <SelectTrigger className="w-full sm:w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <Input
          type="date"
          value={value.from?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              from: e.target.value ? new Date(e.target.value).toISOString() : undefined,
            })
          }
          className="w-full sm:w-[150px]"
        />
        <Input
          type="date"
          value={value.to?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              to: e.target.value ? new Date(e.target.value).toISOString() : undefined,
            })
          }
          className="w-full sm:w-[150px]"
        />
      </div>

      {value.search ||
      value.statuses?.length ||
      value.projectIds?.length ||
      value.from ||
      value.to ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}

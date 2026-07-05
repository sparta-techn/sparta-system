import { useMemo, useState } from "react";
import { Filter, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { seedProjects } from "@/features/projects/mock-data";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type SavedFilter,
  type TaskFilters,
  type TaskSort,
} from "../types";
import { removeSavedFilter, saveFilter, useTasksState } from "../store";
import { cn } from "@/lib/utils";

export function TasksFilterBar({
  filters,
  onChange,
  sort,
  onSortChange,
  className,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  sort: TaskSort;
  onSortChange: (next: TaskSort) => void;
  className?: string;
}) {
  const savedFilters = useTasksState((s) => s.savedFilters);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.status?.length) n += 1;
    if (filters.priority?.length) n += 1;
    if (filters.labels?.length) n += 1;
    if (filters.projectIds?.length) n += 1;
    if (filters.assigneeIds?.length) n += 1;
    if (filters.overdueOnly) n += 1;
    if (filters.unassignedOnly) n += 1;
    if (filters.includeArchived) n += 1;
    return n;
  }, [filters]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by title, ref, or description…"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-9 w-[260px] max-w-full"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="size-4" />
              Filters
              {activeCount ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] space-y-4">
            <Section title="Status">
              {TASK_STATUSES.map((s) => (
                <CheckboxRow
                  key={s}
                  label={STATUS_LABEL[s]}
                  checked={filters.status?.includes(s) ?? false}
                  onChange={(c) =>
                    onChange({
                      ...filters,
                      status: c
                        ? [...(filters.status ?? []), s]
                        : (filters.status ?? []).filter((x) => x !== s),
                    })
                  }
                />
              ))}
            </Section>
            <Section title="Priority">
              {TASK_PRIORITIES.map((p) => (
                <CheckboxRow
                  key={p}
                  label={PRIORITY_LABEL[p]}
                  checked={filters.priority?.includes(p) ?? false}
                  onChange={(c) =>
                    onChange({
                      ...filters,
                      priority: c
                        ? [...(filters.priority ?? []), p]
                        : (filters.priority ?? []).filter((x) => x !== p),
                    })
                  }
                />
              ))}
            </Section>
            <Section title="Labels">
              <div className="flex flex-wrap gap-1.5">
                {TASK_LABELS.map((l) => {
                  const active = filters.labels?.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...filters,
                          labels: active
                            ? (filters.labels ?? []).filter((x) => x !== l)
                            : [...(filters.labels ?? []), l],
                        })
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                      )}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </Section>
            <Section title="Project">
              <Select
                value={filters.projectIds?.[0] ?? "all"}
                onValueChange={(v) =>
                  onChange({ ...filters, projectIds: v === "all" ? undefined : [v] })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {seedProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.icon} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>
            <Separator />
            <div className="space-y-2">
              <CheckboxRow
                label="Overdue only"
                checked={!!filters.overdueOnly}
                onChange={(c) => onChange({ ...filters, overdueOnly: c })}
              />
              <CheckboxRow
                label="Unassigned only"
                checked={!!filters.unassignedOnly}
                onChange={(c) => onChange({ ...filters, unassignedOnly: c })}
              />
              <CheckboxRow
                label="Include archived"
                checked={!!filters.includeArchived}
                onChange={(c) => onChange({ ...filters, includeArchived: c })}
              />
              <CheckboxRow
                label="Top-level tasks only"
                checked={!!filters.topLevelOnly}
                onChange={(c) => onChange({ ...filters, topLevelOnly: c })}
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ topLevelOnly: filters.topLevelOnly })}
              >
                Clear all
              </Button>
              <Popover open={saveOpen} onOpenChange={setSaveOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Star className="size-3.5" /> Save view
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[240px] space-y-2">
                  <Label className="text-xs">View name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mobile bugs"
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!name.trim()}
                    onClick={() => {
                      saveFilter({
                        name: name.trim(),
                        pinned: false,
                        filters,
                        sort,
                        createdBy: "emp_001",
                      });
                      setName("");
                      setSaveOpen(false);
                    }}
                  >
                    Save
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </PopoverContent>
        </Popover>
        <div className="ml-auto flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Sort</Label>
          <Select
            value={`${sort.key}:${sort.direction}`}
            onValueChange={(v) => {
              const [key, direction] = v.split(":") as [TaskSort["key"], "asc" | "desc"];
              onSortChange({ key, direction });
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated:desc">Recently updated</SelectItem>
              <SelectItem value="created:desc">Recently created</SelectItem>
              <SelectItem value="priority:desc">Priority (high → low)</SelectItem>
              <SelectItem value="due:asc">Due date (soonest)</SelectItem>
              <SelectItem value="status:asc">Status (workflow)</SelectItem>
              <SelectItem value="title:asc">Title (A → Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {savedFilters.length ? (
        <SavedFilterPills
          filters={savedFilters}
          onApply={(sf) => {
            onChange(sf.filters);
            if (sf.sort) onSortChange(sf.sort);
          }}
          onRemove={removeSavedFilter}
        />
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <span>{label}</span>
    </label>
  );
}

function SavedFilterPills({
  filters,
  onApply,
  onRemove,
}: {
  filters: SavedFilter[];
  onApply: (sf: SavedFilter) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((sf) => (
        <span
          key={sf.id}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs"
        >
          {sf.pinned ? <Star className="size-3 fill-amber-400 text-amber-500" /> : null}
          <button type="button" onClick={() => onApply(sf)} className="font-medium hover:underline">
            {sf.name}
          </button>
          <button
            type="button"
            onClick={() => onRemove(sf.id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${sf.name}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

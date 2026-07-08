import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS, PEOPLE, PROJECTS } from "../mock-data";
import {
  DEPENDENCY_PRIORITIES,
  DEPENDENCY_STATES,
  DEPENDENCY_TYPES,
  PRIORITY_LABEL,
  STATE_LABEL,
  TYPE_LABEL,
} from "../types";

export interface DepFilterState {
  q: string;
  state: string;
  priority: string;
  department: string;
  owner: string;
  project: string;
  type: string;
}

export const EMPTY_FILTERS: DepFilterState = {
  q: "",
  state: "all",
  priority: "all",
  department: "all",
  owner: "all",
  project: "all",
  type: "all",
};

const SAVED_VIEWS: { name: string; filters: Partial<DepFilterState> }[] = [
  { name: "All open", filters: {} },
  { name: "Critical & high", filters: { priority: "critical" } },
  { name: "Blocked", filters: { state: "blocked" } },
  { name: "Backend asks", filters: { department: "Backend" } },
];

export function DepFilters({
  value,
  onChange,
}: {
  value: DepFilterState;
  onChange: (v: DepFilterState) => void;
}) {
  const set = (patch: Partial<DepFilterState>) => onChange({ ...value, ...patch });
  const active =
    value.q ||
    value.state !== "all" ||
    value.priority !== "all" ||
    value.department !== "all" ||
    value.owner !== "all" ||
    value.project !== "all" ||
    value.type !== "all";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={value.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search title, id, tag…"
            className="pl-8"
            aria-label="Search dependencies"
          />
        </div>
        {SAVED_VIEWS.map((v) => (
          <Button
            key={v.name}
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...EMPTY_FILTERS, ...v.filters })}
          >
            {v.name}
          </Button>
        ))}
        {active && (
          <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <FilterSelect
          label="Status"
          value={value.state}
          onChange={(v) => set({ state: v })}
          options={[
            { value: "all", label: "All statuses" },
            ...DEPENDENCY_STATES.map((s) => ({ value: s, label: STATE_LABEL[s] })),
          ]}
        />
        <FilterSelect
          label="Priority"
          value={value.priority}
          onChange={(v) => set({ priority: v })}
          options={[
            { value: "all", label: "All priorities" },
            ...DEPENDENCY_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={value.type}
          onChange={(v) => set({ type: v })}
          options={[
            { value: "all", label: "All types" },
            ...DEPENDENCY_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
          ]}
        />
        <FilterSelect
          label="Department"
          value={value.department}
          onChange={(v) => set({ department: v })}
          options={[
            { value: "all", label: "All departments" },
            ...DEPARTMENTS.map((d) => ({ value: d, label: d })),
          ]}
        />
        <FilterSelect
          label="Owner"
          value={value.owner}
          onChange={(v) => set({ owner: v })}
          options={[
            { value: "all", label: "All owners" },
            ...PEOPLE.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <FilterSelect
          label="Project"
          value={value.project}
          onChange={(v) => set({ project: v })}
          options={[
            { value: "all", label: "All projects" },
            ...PROJECTS.map((p) => ({ value: p, label: p })),
          ]}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function applyFilters(items: import("../types").Dependency[], f: DepFilterState) {
  return items.filter((d) => {
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${d.id} ${d.title} ${d.description} ${d.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.state !== "all" && d.state !== f.state) return false;
    if (f.priority !== "all" && d.priority !== f.priority) return false;
    if (f.type !== "all" && d.type !== f.type) return false;
    if (f.department !== "all" && d.department !== f.department) return false;
    if (f.owner !== "all" && d.ownerId !== f.owner) return false;
    if (f.project !== "all" && d.project !== f.project) return false;
    return true;
  });
}

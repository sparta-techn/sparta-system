import { CalendarRange, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalyticsFilters } from "../filters-context";
import { filterOptions } from "../mock-data";
import type { BenchmarkPeriod, DateRange } from "../types";

const RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "qtd", label: "Quarter to date" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom…" },
];

const BENCHMARKS: { value: BenchmarkPeriod; label: string }[] = [
  { value: "wow", label: "WoW" },
  { value: "mom", label: "MoM" },
  { value: "qoq", label: "QoQ" },
];

export function FiltersBar({ scope }: { scope: "personal" | "team" | "hr" | "executive" }) {
  const { filters, setFilters, reset } = useAnalyticsFilters();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/40 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarRange className="size-4" aria-hidden />
        <span>Filters</span>
      </div>

      <Select value={filters.range} onValueChange={(v) => setFilters({ range: v as DateRange })}>
        <SelectTrigger className="h-9 w-[180px]" aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {scope !== "personal" && (
        <Select value={filters.department ?? "all"} onValueChange={(v) => setFilters({ department: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Department">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {filterOptions.departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {(scope === "team" || scope === "executive") && (
        <Select value={filters.team ?? "all"} onValueChange={(v) => setFilters({ team: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Team">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {filterOptions.teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {scope !== "personal" && (
        <Select value={filters.role ?? "all"} onValueChange={(v) => setFilters({ role: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Role">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {filterOptions.roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {scope === "team" && (
        <Select value={filters.employee ?? "all"} onValueChange={(v) => setFilters({ employee: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Employee">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {filterOptions.employees.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {(scope === "team" || scope === "executive") && (
        <Select value={filters.project ?? "all"} onValueChange={(v) => setFilters({ project: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Project">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {filterOptions.projects.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Compare</span>
        <Tabs value={filters.benchmark} onValueChange={(v) => setFilters({ benchmark: v as BenchmarkPeriod })}>
          <TabsList className="h-8">
            {BENCHMARKS.map((b) => (
              <TabsTrigger key={b.value} value={b.value} className="h-7 px-2 text-xs">
                {b.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
          <RotateCcw className="mr-1 size-3.5" aria-hidden />
          Reset
        </Button>
      </div>
    </div>
  );
}

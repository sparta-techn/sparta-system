import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { applySprintFilters, useSprintsState } from "@/features/sprints/store";
import type { SprintFilters } from "@/features/sprints/types";
import { SprintCard } from "@/features/sprints/components/sprint-card";
import { SprintsFilterBar } from "@/features/sprints/components/sprints-filter-bar";
import { CreateSprintDialog } from "@/features/sprints/components/create-sprint-dialog";

export const Route = createFileRoute("/_authenticated/app/sprints/")({
  head: () => ({ meta: [{ title: "Sprints · SpartaFlow Hub" }] }),
  component: SprintsIndex,
});

function SprintsIndex() {
  const sprints = useSprintsState((s) => s.sprints);
  const [filters, setFilters] = useState<SprintFilters>({});
  const [creating, setCreating] = useState(false);

  const sorted = useMemo(() => {
    const filtered = applySprintFilters(sprints, filters);
    const rank: Record<string, number> = { active: 0, planned: 1, completed: 2 };
    return [...filtered].sort((a, b) => {
      const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (r !== 0) return r;
      return +new Date(b.startDate) - +new Date(a.startDate);
    });
  }, [sprints, filters]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Delivery"
        title="Sprints"
        description="Group existing tasks into time-boxed iterations. Sprints organize work — they do not own it."
        actions={
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New sprint
          </Button>
        }
      />

      <div className="mb-4">
        <SprintsFilterBar value={filters} onChange={setFilters} />
      </div>

      {sorted.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <div className="text-sm font-medium">No sprints match these filters</div>
          <p className="max-w-sm text-xs text-muted-foreground">
            Try widening your filters, or create a new sprint to start planning the next iteration.
          </p>
          <Button size="sm" className="mt-2 gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New sprint
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => (
            <SprintCard key={s.id} sprint={s} />
          ))}
        </div>
      )}

      <CreateSprintDialog open={creating} onOpenChange={setCreating} />
    </AppShell>
  );
}

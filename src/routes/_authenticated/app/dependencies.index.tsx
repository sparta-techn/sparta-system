import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, KanbanSquare, LayoutGrid, Plus, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepCreateDialog } from "@/features/dependencies/components/dep-create-dialog";
import {
  DepFilters,
  EMPTY_FILTERS,
  applyFilters,
  type DepFilterState,
} from "@/features/dependencies/components/dep-filters";
import { DepKanban } from "@/features/dependencies/components/dep-kanban";
import { DepTable } from "@/features/dependencies/components/dep-table";
import { DepStatGrid } from "@/features/dependencies/components/dep-widgets";
import { useDependencies } from "@/features/dependencies/store";
import { CURRENT_USER_ID } from "@/features/dependencies/mock-data";
import { isOpen, isOverdue } from "@/features/dependencies/utils";

export const Route = createFileRoute("/_authenticated/app/dependencies/")({
  component: DependenciesPage,
});

type View = "board" | "table" | "mine";

function DependenciesPage() {
  const navigate = useNavigate();
  const all = useDependencies();
  const [view, setView] = useState<View>("board");
  const [filters, setFilters] = useState<DepFilterState>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);

  const mineGroups = useMemo(() => {
    return {
      waitingOnOthers: all.filter(
        (d) => d.requesterId === CURRENT_USER_ID && d.ownerId !== CURRENT_USER_ID && isOpen(d),
      ),
      waitingOnMe: all.filter((d) => d.ownerId === CURRENT_USER_ID && isOpen(d)),
      overdue: all.filter(
        (d) => (d.ownerId === CURRENT_USER_ID || d.requesterId === CURRENT_USER_ID) && isOverdue(d),
      ),
      recentlyResolved: all
        .filter(
          (d) =>
            (d.ownerId === CURRENT_USER_ID || d.requesterId === CURRENT_USER_ID) &&
            (d.state === "resolved" || d.state === "closed"),
        )
        .slice(0, 10),
    };
  }, [all]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Collaboration"
        title="Dependencies"
        description="Track every inter-team ask in one place — no more buried Slack threads."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/dependencies/manager">
                <BarChart3 className="size-4" /> Manager view
              </Link>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New dependency
            </Button>
          </>
        }
      />

      <DepStatGrid items={all} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="board">
              <KanbanSquare className="size-4" /> Board
            </TabsTrigger>
            <TabsTrigger value="table">
              <Table2 className="size-4" /> Table
            </TabsTrigger>
            <TabsTrigger value="mine">
              <LayoutGrid className="size-4" /> My dependencies
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {all.length} shown
        </p>
      </div>

      {view !== "mine" && <DepFilters value={filters} onChange={setFilters} />}

      {view === "board" && <DepKanban items={filtered} />}
      {view === "table" && <DepTable items={filtered} />}
      {view === "mine" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MineSection title="Waiting on others" items={mineGroups.waitingOnOthers} />
          <MineSection title="Waiting on me" items={mineGroups.waitingOnMe} />
          <MineSection title="Overdue" items={mineGroups.overdue} />
          <MineSection title="Recently resolved" items={mineGroups.recentlyResolved} />
        </div>
      )}

      <DepCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate({ to: "/app/dependencies/$id", params: { id } })}
      />
    </div>
  );
}

function MineSection({
  title,
  items,
}: {
  title: string;
  items: import("@/features/dependencies/types").Dependency[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing here. 🎉
        </p>
      ) : (
        <DepTable items={items} />
      )}
    </section>
  );
}

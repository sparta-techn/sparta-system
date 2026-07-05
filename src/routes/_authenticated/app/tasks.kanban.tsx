import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KanbanBoard } from "@/features/kanban/components/kanban-board";
import { KanbanFiltersBar } from "@/features/kanban/components/kanban-filters";
import { KanbanSettingsSheet } from "@/features/kanban/components/kanban-settings-sheet";
import type { KanbanFilters } from "@/features/kanban/types";

export const Route = createFileRoute("/_authenticated/app/tasks/kanban")({
  head: () => ({ meta: [{ title: "Kanban · SpartaFlow Hub" }] }),
  component: KanbanPage,
});

function KanbanPage() {
  const [filters, setFilters] = useState<KanbanFilters>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="space-y-4">
      <KanbanFiltersBar
        filters={filters}
        onChange={setFilters}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <KanbanBoard filters={filters} />
      <KanbanSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

/**
 * IntegrationList — the Integration Center grid.
 *
 * Thin assembler (per the architecture's "route files are thin assemblers"):
 * reads the reactive view from {@link useIntegrationCenter} and renders a card per
 * provider, wired to the local mock telemetry service for status/health/last-sync/
 * errors and to a {@link IntegrationDetail} sheet for the full six-view breakdown
 * (adds Configuration + Logs). Every provider — including placeholders — is
 * interactive here; all actions are local and offline.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useIntegrationCenter, type IntegrationCenterRow } from "../hooks";
import { IntegrationCard } from "./integration-card";
import { IntegrationDetail } from "./integration-detail";

export function IntegrationList() {
  const { rows, connect, disconnect, sync, refresh, refreshAll } = useIntegrationCenter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const selected = rows.find((r) => r.metadata.id === selectedId) ?? null;

  const openDetails = (row: IntegrationCenterRow) => {
    setSelectedId(row.metadata.id);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={refreshAll}>
          Refresh all
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <IntegrationCard
            key={row.metadata.id}
            row={row}
            onOpenDetails={openDetails}
            onConnect={(r) => connect(r.metadata.id)}
            onDisconnect={(r) => disconnect(r.metadata.id)}
            onSync={(r) => sync(r.metadata.id)}
          />
        ))}
      </div>

      <IntegrationDetail
        row={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSync={(r) => sync(r.metadata.id)}
        onRefresh={(r) => refresh(r.metadata.id)}
      />
    </div>
  );
}

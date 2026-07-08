/**
 * IntegrationCard — one provider row: identity, live status, capabilities, a
 * telemetry summary (health · last sync · errors) and actions. Reuses `ui/Card`,
 * `ui/Badge`, `ui/Button` per the UI rules (never duplicate primitives).
 * Presentational — it delegates actions to its parent, which owns the service call.
 *
 * Data comes from the reactive Integration Center view model
 * ({@link IntegrationCenterRow}); status/health/last-sync/errors are the local
 * {@link import("../services/mock-telemetry").MockTelemetryService} telemetry.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderStatusBadge } from "./provider-status-badge";
import { healthDotClass, relativeTime } from "./format";
import type { IntegrationCenterRow } from "../hooks";

interface IntegrationCardProps {
  row: IntegrationCenterRow;
  onOpenDetails?: (row: IntegrationCenterRow) => void;
  onConnect?: (row: IntegrationCenterRow) => void;
  onDisconnect?: (row: IntegrationCenterRow) => void;
  onSync?: (row: IntegrationCenterRow) => void;
  busy?: boolean;
}

export function IntegrationCard({
  row,
  onOpenDetails,
  onConnect,
  onDisconnect,
  onSync,
  busy,
}: IntegrationCardProps) {
  const { metadata, telemetry } = row;
  const connected = telemetry.status.connected;
  const errorCount = telemetry.errors.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{metadata.displayName}</CardTitle>
          <CardDescription>{metadata.description}</CardDescription>
        </div>
        <ProviderStatusBadge status={telemetry.status} />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {metadata.capabilities.map((cap) => (
            <Badge key={cap} variant="outline" className="font-mono text-[10px]">
              {cap}
            </Badge>
          ))}
        </div>

        {/* Telemetry summary: health · last sync · errors */}
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Health</dt>
            <dd className="flex items-center gap-1 font-medium">
              <span className={healthDotClass(telemetry.health.state)} aria-hidden>
                ●
              </span>
              <span className="capitalize">{telemetry.health.state}</span>
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="font-medium">{relativeTime(telemetry.lastSync.at)}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Errors</dt>
            <dd className="font-medium">
              {errorCount > 0 ? <span className="text-red-500">{errorCount}</span> : <span>0</span>}
            </dd>
          </div>
        </dl>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {metadata.available ? `${metadata.scope} · ${metadata.auth}` : "Coming soon"}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onOpenDetails?.(row)}>
              Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!connected || busy}
              onClick={() => onSync?.(row)}
            >
              Sync
            </Button>
            <Button
              size="sm"
              variant={connected ? "outline" : "default"}
              disabled={busy}
              onClick={() => (connected ? onDisconnect?.(row) : onConnect?.(row))}
            >
              {connected ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

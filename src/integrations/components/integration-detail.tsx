/**
 * IntegrationDetail — the per-provider detail panel for the Integration Center.
 *
 * A `ui/Sheet` with a `ui/Tabs` for the six views the Center surfaces: Status,
 * Health, Last Sync, Errors, Configuration and Logs. Reuses shared primitives
 * (Sheet, Tabs, Table, ScrollArea, Badge, Separator, Button) — no new UI.
 *
 * Status/Health/Last Sync/Errors/Logs come from the offline telemetry service;
 * Configuration reads the provider's real {@link SettingsSchema} from the
 * SettingsManager and shows each field's default (secrets masked).
 */

import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProviderStatusBadge } from "./provider-status-badge";
import { healthDotClass, logLevelVariant, relativeTime } from "./format";
import type { IntegrationCenterRow } from "../hooks";
import type { SettingsSchema } from "../types";
import { getSettingsManager } from "../services/container";

interface IntegrationDetailProps {
  row: IntegrationCenterRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync?: (row: IntegrationCenterRow) => void;
  onRefresh?: (row: IntegrationCenterRow) => void;
}

export function IntegrationDetail({
  row,
  open,
  onOpenChange,
  onSync,
  onRefresh,
}: IntegrationDetailProps) {
  const [schema, setSchema] = useState<SettingsSchema | null>(null);

  useEffect(() => {
    if (!row || !open) return;
    let active = true;
    void getSettingsManager()
      .schema(row.metadata.id)
      .then((s) => {
        if (active) setSchema(s);
      });
    return () => {
      active = false;
    };
  }, [row, open]);

  if (!row) return null;
  const { metadata, telemetry } = row;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle>{metadata.displayName}</SheetTitle>
            <ProviderStatusBadge status={telemetry.status} />
          </div>
          <SheetDescription>{metadata.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onRefresh?.(row)}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!telemetry.status.connected}
            onClick={() => onSync?.(row)}
          >
            Sync now
          </Button>
        </div>

        <Tabs defaultValue="status" className="mt-4">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="sync">Last Sync</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Status */}
          <TabsContent value="status" className="pt-2">
            <DefinitionList
              rows={[
                ["State", <ProviderStatusBadge key="s" status={telemetry.status} />],
                ["Connected", telemetry.status.connected ? "Yes" : "No"],
                ["Accounts", String(telemetry.status.accountCount)],
                ["Last checked", relativeTime(telemetry.status.lastCheckedAt)],
                ["Message", telemetry.status.message ?? "—"],
              ]}
            />
          </TabsContent>

          {/* Health */}
          <TabsContent value="health" className="pt-2">
            <DefinitionList
              rows={[
                [
                  "Probe",
                  <span key="h" className="flex items-center gap-1.5 font-medium capitalize">
                    <span className={healthDotClass(telemetry.health.state)} aria-hidden>
                      ●
                    </span>
                    {telemetry.health.state}
                  </span>,
                ],
                ["Latency", `${telemetry.health.latencyMs} ms`],
                ["Checked", relativeTime(telemetry.health.checkedAt)],
              ]}
            />
          </TabsContent>

          {/* Last Sync */}
          <TabsContent value="sync" className="pt-2">
            <DefinitionList
              rows={[
                ["Last run", relativeTime(telemetry.lastSync.at)],
                ["Result", telemetry.lastSync.ok ? "OK" : "Failed"],
                ["Items processed", String(telemetry.lastSync.itemsProcessed)],
                ["Duration", `${telemetry.lastSync.durationMs} ms`],
                ["Cursor", telemetry.lastSync.cursor ?? "—"],
              ]}
            />
          </TabsContent>

          {/* Errors */}
          <TabsContent value="errors" className="pt-2">
            {telemetry.errors.length === 0 ? (
              <EmptyState message="No recent errors." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {telemetry.errors.map((err, i) => (
                    <TableRow key={`${err.code}-${i}`}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {relativeTime(err.at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-mono text-[10px]">
                          {err.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Configuration */}
          <TabsContent value="config" className="pt-2">
            {!schema ? (
              <EmptyState message="Loading configuration…" />
            ) : schema.fields.length === 0 ? (
              <EmptyState message="This provider has no configurable settings." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setting</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schema.fields.map((field) => (
                    <TableRow key={field.key}>
                      <TableCell>
                        <div className="font-medium">{field.label}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {field.key}
                          {field.required ? " *" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{field.type}</TableCell>
                      <TableCell>{formatConfigValue(field.type, field.default)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Logs */}
          <TabsContent value="logs" className="pt-2">
            {telemetry.logs.length === 0 ? (
              <EmptyState message="No log entries." />
            ) : (
              <ScrollArea className="h-72 rounded-md border">
                <ul className="divide-y">
                  {telemetry.logs.map((log, i) => (
                    <li key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                      <Badge
                        variant={logLevelVariant(log.level)}
                        className="font-mono text-[10px] uppercase"
                      >
                        {log.level}
                      </Badge>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {relativeTime(log.at)}
                      </span>
                      <span className="flex-1">{log.message}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />
        <p className="text-[11px] text-muted-foreground">
          Telemetry is served by a local mock service — no external API is contacted.
        </p>
      </SheetContent>
    </Sheet>
  );
}

function DefinitionList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y rounded-md border">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

/** Render a settings field's default value for display (secrets masked). */
function formatConfigValue(type: string, value: unknown): string {
  if (type === "secret") return "••••••••";
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

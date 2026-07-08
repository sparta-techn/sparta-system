import { useState } from "react";
import { CalendarClock, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/states";
import { initialSavedReports } from "../mock-data";
import type { SavedReport } from "../types";

export function SavedReportsList() {
  const [reports, setReports] = useState<SavedReport[]>(initialSavedReports);
  const [name, setName] = useState("");

  const togglePin = (id: string) =>
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)));
  const remove = (id: string) => setReports((rs) => rs.filter((r) => r.id !== id));
  const create = () => {
    if (!name.trim()) return;
    const r: SavedReport = {
      id: `sr_${Date.now()}`,
      name: name.trim(),
      scope: "team",
      filters: { range: "30d", benchmark: "mom" },
      pinned: false,
      createdAt: new Date().toISOString(),
    };
    setReports((rs) => [r, ...rs]);
    setName("");
    toast.success("Report saved", { description: "Available in the saved reports list." });
  };

  const pinned = reports.filter((r) => r.pinned);
  const others = reports.filter((r) => !r.pinned);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Save current view as a report</CardTitle>
          <CardDescription>
            Persist the active filters and dashboard so you can return or share it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly engineering snapshot"
            className="max-w-sm"
            aria-label="Report name"
          />
          <Button onClick={create} disabled={!name.trim()}>
            <Plus className="mr-2 size-4" aria-hidden /> Save report
          </Button>
        </CardContent>
      </Card>

      {pinned.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Pinned</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {pinned.map((r) => (
              <ReportRow key={r.id} report={r} onPin={togglePin} onRemove={remove} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">All saved reports</h3>
        {reports.length === 0 ? (
          <EmptyState
            title="No saved reports"
            description="Create one above to pin a dashboard or schedule exports."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {others.map((r) => (
              <ReportRow key={r.id} report={r} onPin={togglePin} onRemove={remove} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportRow({
  report,
  onPin,
  onRemove,
}: {
  report: SavedReport;
  onPin: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{report.name}</p>
            <Badge variant="outline" className="capitalize">
              {report.scope}
            </Badge>
            {report.schedule ? (
              <Badge variant="secondary">
                <CalendarClock className="mr-1 size-3" aria-hidden /> {report.schedule}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Range {report.filters.range.toUpperCase()} · vs {report.filters.benchmark.toUpperCase()}
            {report.filters.department ? ` · ${report.filters.department}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Saved {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPin(report.id)}
            aria-label={report.pinned ? "Unpin" : "Pin"}
          >
            {report.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(report.id)}
            aria-label="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

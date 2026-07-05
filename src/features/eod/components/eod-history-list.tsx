import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Search } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { generateHistorySeed } from "../mock-data";
import { useEodHistory } from "../store";
import type { EodSubmission } from "../types";

type RangeKey = "all" | "7d" | "30d" | "90d";

export function EodHistoryList() {
  const real = useEodHistory();
  const items: EodSubmission[] = real.length > 0 ? real : generateHistorySeed();

  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const now = Date.now();
    const minDate = ((): number | null => {
      if (range === "7d") return now - 7 * 86400000;
      if (range === "30d") return now - 30 * 86400000;
      if (range === "90d") return now - 90 * 86400000;
      return null;
    })();
    return items.filter((s) => {
      const ts = new Date(s.workDate).getTime();
      if (minDate && ts < minDate) return false;
      if (from && s.workDate < from) return false;
      if (to && s.workDate > to) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          s.summary,
          ...s.tomorrow.priorities,
          ...s.tomorrow.tasks,
          ...s.completed.map((c) => c.title),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, range, from, to]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" aria-hidden /> Filter reports
          </CardTitle>
          <CardDescription>Search across summaries, completed work and tomorrow plans.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="eod-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="eod-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="auth, pagination, deploy…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eod-range">Range</Label>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger id="eod-range" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eod-from">From</Label>
            <Input id="eod-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eod-to">To</Label>
            <Input id="eod-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} report{filtered.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No reports match these filters.
            </p>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filtered.map((s) => {
                const date = new Date(s.workDate).toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const completed = s.completed.filter((c) => c.state === "completed").length;
                return (
                  <AccordionItem
                    key={s.id}
                    value={s.id}
                    className="rounded-lg border bg-card data-[state=open]:border-primary/30"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{date}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{s.summary}</p>
                        </div>
                        <StatusBadge
                          tone={completed > 0 ? "success" : "neutral"}
                          label={`${completed} done`}
                          size="sm"
                          withDot={false}
                        />
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" aria-hidden />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <ReportDetail s={s} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportDetail({ s }: { s: EodSubmission }) {
  return (
    <div className="space-y-3 text-sm">
      <Block label="Summary">{s.summary || "—"}</Block>
      {s.tomorrow.priorities.length > 0 ? (
        <Block label="Tomorrow's priorities">
          <ul className="list-disc space-y-0.5 pl-4">
            {s.tomorrow.priorities.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Block>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-4 text-xs">
        <Kv label="Check-in" value={s.sessionSummary.checkIn ?? "—"} />
        <Kv label="Check-out" value={s.sessionSummary.checkOut ?? "—"} />
        <Kv label="Worked" value={fmt(s.sessionSummary.workedMinutes)} />
        <Kv label="Breaks" value={fmt(s.sessionSummary.breakMinutes)} />
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="rounded-md border bg-card p-3 text-foreground">{children}</div>
    </div>
  );
}
function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-2.5 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
function fmt(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

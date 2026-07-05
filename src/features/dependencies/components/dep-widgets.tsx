import { Link } from "@tanstack/react-router";
import { AlertOctagon, CheckCircle2, Clock, Inbox, Send, Zap } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CURRENT_USER_ID, personById } from "../mock-data";
import { useDependencies } from "../store";
import type { Dependency } from "../types";
import { isOpen, isOverdue, timeAgo } from "../utils";
import { PriorityPill, StatePill } from "./dep-badges";

/** Stat row for the Dependencies index + Dashboard. */
export function DepStatGrid({ items }: { items: Dependency[] }) {
  const open = items.filter(isOpen);
  const blocked = items.filter((d) => d.state === "blocked");
  const critical = open.filter((d) => d.priority === "critical");
  const overdue = items.filter(isOverdue);
  const waitingOnMe = open.filter((d) => d.ownerId === CURRENT_USER_ID);
  const waitingOnOthers = open.filter(
    (d) => d.requesterId === CURRENT_USER_ID && d.ownerId !== CURRENT_USER_ID,
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Open" value={open.length} icon={Inbox} hint="Across all teams" />
      <StatCard label="Blocked" value={blocked.length} icon={AlertOctagon} hint="Needs unblocking" />
      <StatCard label="Critical" value={critical.length} icon={Zap} hint="Priority = critical" />
      <StatCard label="Overdue" value={overdue.length} icon={Clock} hint="Past due date" />
      <StatCard label="Waiting on me" value={waitingOnMe.length} icon={Send} hint="You own" />
      <StatCard label="Waiting on others" value={waitingOnOthers.length} icon={CheckCircle2} hint="You requested" />
    </div>
  );
}

/** Compact dashboard widget — used on /app. */
export function DependenciesDashboardWidget() {
  const all = useDependencies();
  const waitingOnMe = all
    .filter((d) => d.ownerId === CURRENT_USER_ID && isOpen(d))
    .slice(0, 4);
  const waitingOnOthers = all
    .filter((d) => d.requesterId === CURRENT_USER_ID && d.ownerId !== CURRENT_USER_ID && isOpen(d))
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">Dependencies</CardTitle>
          <p className="text-xs text-muted-foreground">Inbound and outbound asks</p>
        </div>
        <Link
          to="/app/dependencies"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open board →
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <DepMiniList title="Waiting on me" items={waitingOnMe} emptyLabel="Nothing assigned to you" />
        <DepMiniList
          title="Waiting on others"
          items={waitingOnOthers}
          emptyLabel="You're not blocked on anyone"
        />
      </CardContent>
    </Card>
  );
}

function DepMiniList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Dependency[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-[11px] text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((d) => {
            const other = personById(d.ownerId === CURRENT_USER_ID ? d.requesterId : d.ownerId);
            return (
              <li key={d.id}>
                <Link
                  to="/app/dependencies/$id"
                  params={{ id: d.id }}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-xs font-medium text-foreground">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {other?.name ?? "Unassigned"} · {timeAgo(d.updatedAt)}
                      {isOverdue(d) ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PriorityPill priority={d.priority} />
                    <StatePill state={d.state} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

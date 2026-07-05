import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { personById } from "../mock-data";
import type { Dependency } from "../types";
import { dueLabel, isOverdue, timeAgo } from "../utils";
import { PersonChip, PriorityPill, StatePill, TypePill } from "./dep-badges";

type SortKey = "updatedAt" | "createdAt" | "dueAt" | "priority" | "title";
const PRIORITY_ORDER = { low: 1, medium: 2, high: 3, critical: 4 } as const;
const PAGE_SIZE = 10;

export function DepTable({ items }: { items: Dependency[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "updatedAt",
    dir: "desc",
  });
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "priority") {
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      } else if (sort.key === "title") {
        cmp = a.title.localeCompare(b.title);
      } else {
        const av = a[sort.key] ? new Date(a[sort.key] as string).getTime() : 0;
        const bv = b[sort.key] ? new Date(b[sort.key] as string).getTime() : 0;
        cmp = av - bv;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [items, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
    setPage(0);
  }

  function SortBtn({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sort.key === k;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {children}
        {active ? <span aria-hidden>{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center text-sm text-muted-foreground">
        No dependencies match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]"><SortBtn k="title">Dependency</SortBtn></TableHead>
              <TableHead>Status</TableHead>
              <TableHead><SortBtn k="priority">Priority</SortBtn></TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Project</TableHead>
              <TableHead><SortBtn k="dueAt">Due</SortBtn></TableHead>
              <TableHead><SortBtn k="updatedAt">Updated</SortBtn></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((d) => {
              const owner = personById(d.ownerId);
              const overdue = isOverdue(d);
              return (
                <TableRow key={d.id} className="align-top">
                  <TableCell>
                    <Link
                      to="/app/dependencies/$id"
                      params={{ id: d.id }}
                      className="block max-w-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      <p className="font-mono text-[11px] text-muted-foreground">{d.id}</p>
                      <p className="line-clamp-1 text-sm font-medium text-foreground hover:underline">{d.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <TypePill type={d.type} />
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell><StatePill state={d.state} /></TableCell>
                  <TableCell><PriorityPill priority={d.priority} /></TableCell>
                  <TableCell>
                    {owner ? (
                      <PersonChip name={owner.name} color={owner.avatarColor} sub={owner.department} />
                    ) : (
                      <span className="text-xs italic text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.project}</TableCell>
                  <TableCell className={overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {dueLabel(d)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(d.updatedAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {sorted.length === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min(sorted.length, (page + 1) * PAGE_SIZE)}`} of{" "}
          {sorted.length}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="tabular-nums">
            Page {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { CheckCheck, Filter, Inbox, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getCurrentUserId } from "../directory";
import { notificationStore, useMinuteTick, useNotifications } from "../store";
import { BUCKET_LABEL, CATEGORY_LABEL, bucketOf } from "../ui";
import type { NotificationPriority, NotificationType, PreferenceCategory } from "../types";
import { NotificationRow } from "./notification-dropdown";

type Tab = "all" | "unread" | "archived";

export function NotificationCenter() {
  const userId = getCurrentUserId();
  useMinuteTick();
  const all = useNotifications(userId);

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PreferenceCategory | "all">("all");
  const [type, setType] = useState<NotificationType | "all">("all");
  const [priority, setPriority] = useState<NotificationPriority | "all">("all");

  const filtered = useMemo(() => {
    return all.filter((n) => {
      if (tab === "unread" && (n.readAt || n.archivedAt)) return false;
      if (tab === "archived" && !n.archivedAt) return false;
      if (tab === "all" && n.archivedAt) return false;
      if (category !== "all" && n.category !== category) return false;
      if (type !== "all" && n.type !== type) return false;
      if (priority !== "all" && n.priority !== priority) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${n.title} ${n.body}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [all, tab, category, type, priority, search]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof filtered> = { today: [], yesterday: [], earlier: [] };
    for (const n of filtered) g[bucketOf(n.createdAt)].push(n);
    return g;
  }, [filtered]);

  const unread = all.filter((n) => !n.readAt && !n.archivedAt).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-primary" aria-hidden /> Filter
            </CardTitle>
            <CardDescription>{unread > 0 ? `${unread} unread` : "All caught up."}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={unread === 0}
            onClick={() => notificationStore.markAllRead(userId)}
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="ntf-search">Search</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="ntf-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="mention, blocker, overdue…"
                className="pl-8"
              />
            </div>
          </div>
          <FilterSelect
            id="ntf-cat"
            label="Category"
            value={category}
            onChange={(v) => setCategory(v as PreferenceCategory | "all")}
            options={[
              { value: "all", label: "All categories" },
              ...(Object.entries(CATEGORY_LABEL) as [PreferenceCategory, string][]).map(
                ([k, v]) => ({ value: k, label: v }),
              ),
            ]}
          />
          <FilterSelect
            id="ntf-type"
            label="Type"
            value={type}
            onChange={(v) => setType(v as NotificationType | "all")}
            options={[
              { value: "all", label: "Any type" },
              { value: "info", label: "Information" },
              { value: "success", label: "Success" },
              { value: "warning", label: "Warning" },
              { value: "critical", label: "Critical" },
              { value: "reminder", label: "Reminder" },
            ]}
          />
          <FilterSelect
            id="ntf-pri"
            label="Priority"
            value={priority}
            onChange={(v) => setPriority(v as NotificationPriority | "all")}
            options={[
              { value: "all", label: "Any priority" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread{unread ? ` · ${unread}` : ""}</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Inbox className="size-7 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Nothing here</p>
              <p className="text-xs text-muted-foreground">
                Try a different filter, or wait for the next event.
              </p>
            </div>
          ) : (
            (["today", "yesterday", "earlier"] as const).map((b) =>
              grouped[b].length === 0 ? null : (
                <div key={b} className="border-t first:border-t-0">
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {BUCKET_LABEL[b]}
                  </p>
                  {grouped[b].map((n) => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

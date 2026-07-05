import { useMemo, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/features/hr/components/empty-state";
import { filterAudit, useAuditLog } from "../audit-store";
import { ACTION_LABEL, SENSITIVE_ACTIONS, type AuditAction, type AuditCategory } from "../types";

const CATEGORIES: (AuditCategory | "all")[] = [
  "all",
  "auth",
  "access",
  "employee",
  "project",
  "settings",
];

const ACTIONS: (AuditAction | "all")[] = [
  "all",
  "login",
  "logout",
  "failed_login",
  "role_changed",
  "permission_changed",
  "employee_created",
  "employee_deleted",
  "project_deleted",
  "settings_changed",
];

/** System / security audit log — who did what, when, and what changed. */
export function AuditLogView() {
  const events = useAuditLog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [action, setAction] = useState<AuditAction | "all">("all");

  const filtered = useMemo(
    () => filterAudit(events, { query, category, action }),
    [events, query, category, action],
  );

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" /> Security audit log
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search actor, target, values"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
            aria-label="Search audit log"
          />
          <Select value={category} onValueChange={(v) => setCategory(v as AuditCategory | "all")}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={(v) => setAction(v as AuditAction | "all")}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === "all" ? "All actions" : ACTION_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState title="No matching events" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{e.actor}</TableCell>
                    <TableCell>
                      <Badge variant={SENSITIVE_ACTIONS.has(e.action) ? "destructive" : "outline"}>
                        {ACTION_LABEL[e.action]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{e.target}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.oldValue || e.newValue ? (
                        <span className="inline-flex items-center gap-1">
                          {e.oldValue ? <span className="line-through">{e.oldValue}</span> : null}
                          {e.oldValue && e.newValue ? <ArrowRight className="size-3" /> : null}
                          {e.newValue ? (
                            <span className="text-foreground">{e.newValue}</span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

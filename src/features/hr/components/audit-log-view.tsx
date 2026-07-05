import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { auditLog } from "../mock-data";
import { EmptyState } from "./empty-state";

const CATS = ["all", "employee", "role", "department", "invitation", "leave", "document"] as const;

export function AuditLogView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const filtered = useMemo(() => auditLog.filter((a) => {
    if (cat !== "all" && a.category !== cat) return false;
    if (q) {
      const s = q.toLowerCase();
      if (![a.actor, a.action, a.target, a.details ?? ""].some((v) => v.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [q, cat]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-sm flex items-center gap-2"><History className="size-4" /> Audit log</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search actor, target, details" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATS.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? <EmptyState title="No matching events" /> : (
          <ul className="space-y-2">
            {filtered.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm"><span className="font-medium">{a.actor}</span> {a.action.toLowerCase()} <span className="font-medium">{a.target}</span></p>
                  {a.details ? <p className="text-xs text-muted-foreground">{a.details}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline">{a.category}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

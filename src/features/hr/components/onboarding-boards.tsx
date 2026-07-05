import { useState } from "react";
import { Check, CircleDot, Circle, GraduationCap, Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { employeeById, employees, offboardingTasks, onboardingTasks } from "../mock-data";
import { EmployeeAvatar } from "./employee-avatar";
import { EmptyState } from "./empty-state";

const OWNER_LABEL = { hr: "HR", it: "IT", manager: "Manager", employee: "Employee" };

export function OnboardingBoard() {
  const ids = Array.from(new Set(onboardingTasks.map((t) => t.employeeId)));
  const [activeId, setActiveId] = useState(ids[0]);
  const tasks = onboardingTasks.filter((t) => t.employeeId === activeId);
  const employee = employeeById(activeId);
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={activeId} onValueChange={setActiveId}>
          <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ids.map((id) => {
              const e = employeeById(id);
              return <SelectItem key={id} value={id}>{e?.name} — {e?.department}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Badge variant="outline">{done}/{tasks.length} completed · {pct}%</Badge>
      </div>

      {!employee ? <EmptyState title="No onboarding in progress" icon={GraduationCap} /> : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm"><EmployeeAvatar employee={employee} size={28} /> {employee.name}</CardTitle>
            <Button size="sm" variant="outline">Add task</Button>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-md border p-3">
                  {t.status === "done" ? <Check className="size-4 text-success" /> : t.status === "in_progress" ? <CircleDot className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">Owner: {OWNER_LABEL[t.owner]}{t.dueAt ? ` · Due ${new Date(t.dueAt).toLocaleDateString()}` : ""}</p>
                  </div>
                  <Badge variant={t.status === "done" ? "default" : t.status === "in_progress" ? "secondary" : "outline"}>{t.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function OffboardingBoard() {
  const employee = employeeById(offboardingTasks[0]?.employeeId ?? "");
  const tasks = offboardingTasks;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {!employee ? <EmptyState title="No active offboarding" icon={Plane} /> : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <EmployeeAvatar employee={employee} size={28} /> {employee.name} · exits {new Date(tasks[0].exitDate).toLocaleDateString()}
            </CardTitle>
            <Badge variant="outline">{done}/{tasks.length} · {pct}%</Badge>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-md border p-3">
                  {t.status === "done" ? <Check className="size-4 text-success" /> : t.status === "in_progress" ? <CircleDot className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">Owner: {OWNER_LABEL[t.owner]}</p>
                  </div>
                  <Badge variant={t.status === "done" ? "default" : t.status === "in_progress" ? "secondary" : "outline"}>{t.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Recently offboarded</CardTitle></CardHeader>
        <CardContent>
          {employees.filter((e) => e.status === "deactivated").length === 0 ? <EmptyState title="No archived employees" /> : (
            <ul className="space-y-2">
              {employees.filter((e) => e.status === "deactivated").map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <EmployeeAvatar employee={e} size={28} />
                    <div><p className="text-sm font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.jobTitle} · {e.department}</p></div>
                  </div>
                  <Button size="sm" variant="outline">Reactivate</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

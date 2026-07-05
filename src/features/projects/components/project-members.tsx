import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/features/hr/components/employee-avatar";
import { personById, updateProject, useProjectsState } from "../store";
import type { Project, ProjectMember, ProjectRole } from "../types";

const ROLES: ProjectRole[] = ["lead", "contributor", "reviewer", "stakeholder"];

export function ProjectMembers({ project }: { project: Project }) {
  const [addOpen, setAddOpen] = useState(false);

  function changeRole(id: string, role: ProjectRole) {
    updateProject(project.id, {
      members: project.members.map((m) => (m.employeeId === id ? { ...m, projectRole: role } : m)),
    });
  }
  function remove(id: string) {
    updateProject(project.id, { members: project.members.filter((m) => m.employeeId !== id) });
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-base font-semibold">Members</h2>
          <p className="text-xs text-muted-foreground">{project.members.length} on this project</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add members
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Project role</TableHead>
            <TableHead>Assigned tasks</TableHead>
            <TableHead>Workload</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {project.members.map((m, i) => {
            const emp = personById(m.employeeId);
            if (!emp) return null;
            const assigned = 4 + ((i * 7) % 11);
            const load = Math.min(100, 35 + ((i * 13) % 65));
            return (
              <TableRow key={m.employeeId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar employee={emp} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{emp.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{emp.jobTitle}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{emp.department}</TableCell>
                <TableCell>
                  <Select
                    value={m.projectRole}
                    onValueChange={(v) => changeRole(m.employeeId, v as ProjectRole)}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="tabular-nums text-sm">{assigned}</TableCell>
                <TableCell>
                  <WorkloadBar value={load} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(m.employeeId)}
                    aria-label={`Remove ${emp.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AddMembersDialog project={project} open={addOpen} onOpenChange={setAddOpen} />
    </Card>
  );
}

function WorkloadBar({ value }: { value: number }) {
  const intent = value > 85 ? "bg-rose-500" : value > 65 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${intent}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}

function AddMembersDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const current = new Set(project.members.map((m) => m.employeeId));
  const [selected, setSelected] = useState<string[]>([]);
  const people = useProjectsState((s) => s.people);
  const available = people.filter((e) => !current.has(e.id));

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function commit() {
    const additions: ProjectMember[] = selected.map((id) => ({
      employeeId: id,
      projectRole: "contributor",
    }));
    updateProject(project.id, { members: [...project.members, ...additions] });
    setSelected([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
        </DialogHeader>
        <div className="max-h-[400px] space-y-1 overflow-auto rounded-md border p-2">
          {available.map((e) => {
            const isSel = selected.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggle(e.id)}
                className={`flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted ${isSel ? "bg-muted" : ""}`}
              >
                <EmployeeAvatar employee={e} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.jobTitle} · {e.department}
                  </p>
                </div>
                {isSel ? <Badge variant="secondary">Selected</Badge> : null}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={selected.length === 0}>
            Add {selected.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

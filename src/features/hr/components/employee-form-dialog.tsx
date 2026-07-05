import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { departments, type Department, type EmployeeRole, type HrEmployee } from "../mock-data";
import { createEmployee, editEmployee } from "../employees-store";
import { recordAudit } from "@/features/audit/audit-store";
import { ROLE_OPTIONS } from "./employee-role-options";

interface FormState {
  name: string;
  email: string;
  jobTitle: string;
  department: Department;
  team: string;
  role: EmployeeRole;
  workMode: HrEmployee["workMode"];
}

function fromEmployee(e?: HrEmployee): FormState {
  return {
    name: e?.name ?? "",
    email: e?.email ?? "",
    jobTitle: e?.jobTitle && e.jobTitle !== "—" ? e.jobTitle : "",
    department: e?.department ?? "Engineering",
    team: e?.team && e.team !== "—" ? e.team : "",
    role: e?.role ?? "employee",
    workMode: e?.workMode ?? "Remote",
  };
}

/** Create (no `employee`) or edit an employee record. */
export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee?: HrEmployee;
}) {
  const isEdit = !!employee;
  const [form, setForm] = useState<FormState>(fromEmployee(employee));

  useEffect(() => {
    if (open) setForm(fromEmployee(employee));
  }, [open, employee]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (isEdit && employee) {
      editEmployee(employee.id, form);
      toast.success("Employee updated", { description: form.name });
    } else {
      createEmployee(form);
      recordAudit({
        action: "employee_created",
        target: form.name.trim(),
        targetType: "employee",
        newValue: `${form.department} · ${form.role}`,
      });
      toast.success("Employee created", { description: form.name });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "New employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this employee's core details."
              : "Create an employee record directly. Use Invite to send a setup email instead."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Full name</Label>
              <Input
                id="emp-name"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-email">Email</Label>
              <Input
                id="emp-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-title">Job title</Label>
            <Input
              id="emp-title"
              value={form.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-dept">Department</Label>
              <Select
                value={form.department}
                onValueChange={(v) => set("department", v as Department)}
              >
                <SelectTrigger id="emp-dept">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-team">Team</Label>
              <Input
                id="emp-team"
                value={form.team}
                onChange={(e) => set("team", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-role">Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v as EmployeeRole)}>
                <SelectTrigger id="emp-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-mode">Work mode</Label>
              <Select
                value={form.workMode}
                onValueChange={(v) => set("workMode", v as HrEmployee["workMode"])}
              >
                <SelectTrigger id="emp-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Remote">Remote</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save changes" : "Create employee"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

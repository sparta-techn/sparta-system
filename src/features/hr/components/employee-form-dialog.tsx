import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { type Department, type EmployeeRole, type HrEmployee } from "../mock-data";
import { createEmployee } from "../employees-store";
import { useEmployeeManagement } from "../use-employee-management";
import { hrQueries } from "../queries";
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
    department: e?.department ?? ("" as Department),
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
  const mgmt = useEmployeeManagement();
  // Live, org-specific department list (Supabase-backed) — not a fixed sample.
  const { data: departments = [] } = useQuery(hrQueries.departments());
  const [form, setForm] = useState<FormState>(fromEmployee(employee));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setForm(fromEmployee(employee));
  }, [open, employee]);

  // Default the department to the first live option when creating (no preset).
  // On edit, an existing department is preserved even if it's since been archived.
  useEffect(() => {
    if (open && !form.department && departments.length > 0) {
      set("department", departments[0] as Department);
    }
  }, [open, departments, form.department]);

  // Keep an archived/legacy department selectable on edit so its value shows.
  const departmentOptions = useMemo(
    () =>
      form.department && !departments.includes(form.department)
        ? [form.department, ...departments]
        : departments,
    [departments, form.department],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (isEdit && employee) {
      setSubmitting(true);
      try {
        // Real write-through: name/email/title → profiles, dept/team/mode → employees.
        await mgmt.edit(employee, form);
        toast.success("Employee updated", { description: form.name });
        onOpenChange(false);
      } catch (err) {
        toast.error("Couldn't update employee", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Create stays local for now (a real hire goes through the invitation flow).
    createEmployee(form);
    recordAudit({
      action: "employee_created",
      target: form.name.trim(),
      targetType: "employee",
      newValue: `${form.department} · ${form.role}`,
    });
    toast.success("Employee created", { description: form.name });
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
                  {departmentOptions.map((d) => (
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
            {/* Role is set here only when creating; edits use the dedicated
                "Assign role" action (it writes to user_roles). */}
            {!isEdit && (
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
            )}
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

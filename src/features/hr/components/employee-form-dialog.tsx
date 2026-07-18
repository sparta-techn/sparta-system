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
import { useEmployeeManagement, type EmployeeEditInput } from "../use-employee-management";
import { acceptInvitationRedirectUrl, inviteEmployeeFn } from "../invite.functions";
import { hrQueries } from "../queries";
import { getErrorMessage } from "@/lib/errors";
import { recordAudit } from "@/features/audit/audit-store";
import { useAuth } from "@/features/auth/auth-context";
import { ROLE_OPTIONS } from "./employee-role-options";

interface FormState {
  name: string;
  email: string;
  jobTitle: string;
  department: Department;
  team: string;
  role: EmployeeRole;
  employmentTypeId: string;
  workMode: HrEmployee["workMode"];
  // Pay rates — as raw input strings; only surfaced to `payroll.manage` holders.
  hourlyRate: string;
  monthlySalary: string;
  currency: string;
}

function fromEmployee(e?: HrEmployee): FormState {
  return {
    name: e?.name ?? "",
    email: e?.email ?? "",
    jobTitle: e?.jobTitle && e.jobTitle !== "—" ? e.jobTitle : "",
    department: e?.department ?? ("" as Department),
    team: e?.team && e.team !== "—" ? e.team : "",
    role: e?.role ?? "employee",
    // Resolved to a real id from the loaded employment types (see effect below).
    employmentTypeId: "",
    workMode: e?.workMode ?? "Remote",
    // Pay is hydrated async from the compensation row / org default (see effects).
    hourlyRate: "",
    monthlySalary: "",
    currency: "",
  };
}

/** Parse a rate input to a number, or `null` when blank/invalid/negative. */
function parseRate(value: string): number | null {
  const n = Number(value.trim());
  return value.trim() === "" || Number.isNaN(n) || n < 0 ? null : n;
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
  const { hasPermission } = useAuth();
  // Pay fields are only shown to (and only writable by) payroll managers; RLS
  // is the authoritative backstop on the write.
  const canManagePay = hasPermission("payroll.manage");
  // Live, org-specific department list (Supabase-backed) — not a fixed sample.
  const { data: departments = [] } = useQuery(hrQueries.departments());
  // Real employment types (Full-time / Part-time / …) from the reference table.
  const { data: employmentTypes = [] } = useQuery(hrQueries.employmentTypes());
  // Existing pay row (edit only) + org default currency, both to prefill below.
  const compQuery = useQuery({
    ...hrQueries.compensation(employee?.id ?? ""),
    enabled: open && canManagePay && !!employee?.id,
  });
  const currencyQuery = useQuery({
    ...hrQueries.defaultCurrency(),
    enabled: open && canManagePay,
  });
  const [form, setForm] = useState<FormState>(fromEmployee(employee));
  const [payHydrated, setPayHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(fromEmployee(employee));
      setPayHydrated(false);
    }
  }, [open, employee]);

  // Prefill the pay fields once per open: from the employee's compensation row
  // when one exists, else seed the currency from the org default. Runs after the
  // async reads resolve; guarded so it never clobbers what the user has typed.
  useEffect(() => {
    if (!open || !canManagePay || payHydrated) return;
    const compReady = !employee?.id || compQuery.isSuccess;
    const currencyReady = currencyQuery.isSuccess || currencyQuery.isError;
    if (!compReady || !currencyReady) return;
    const comp = compQuery.data;
    setForm((f) => ({
      ...f,
      hourlyRate: comp?.hourly_rate != null ? String(comp.hourly_rate) : "",
      monthlySalary: comp?.monthly_salary != null ? String(comp.monthly_salary) : "",
      currency: comp?.currency || currencyQuery.data || "EGP",
    }));
    setPayHydrated(true);
  }, [
    open,
    canManagePay,
    payHydrated,
    employee?.id,
    compQuery.isSuccess,
    compQuery.data,
    currencyQuery.isSuccess,
    currencyQuery.isError,
    currencyQuery.data,
  ]);

  // Resolve the selected employment type id once the reference list is loaded:
  // on edit, match the employee's current type by name; on create, default to
  // Full-time (else the first option). Skips if a choice was already made.
  useEffect(() => {
    if (!open || employmentTypes.length === 0 || form.employmentTypeId) return;
    const current = employee
      ? employmentTypes.find((t) => t.name === employee.employmentType)
      : undefined;
    const fullTime = employmentTypes.find((t) => t.slug === "full-time");
    set("employmentTypeId", (current ?? fullTime ?? employmentTypes[0]).id);
  }, [open, employmentTypes, employee, form.employmentTypeId]);

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

  // Full-time pay is driven by monthly salary, everyone else by an hourly rate
  // (mirrors the payroll calc), so we surface only the relevant input.
  const selectedType = employmentTypes.find((t) => t.id === form.employmentTypeId);
  const paysMonthly = selectedType?.slug === "full-time";

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // The core fields plus, for payroll managers, the pay trio. When the user
  // can't manage pay the pay fields are omitted entirely so the compensation
  // row is left untouched.
  function buildEditInput(): EmployeeEditInput {
    const base: EmployeeEditInput = {
      name: form.name,
      email: form.email,
      jobTitle: form.jobTitle,
      department: form.department,
      team: form.team,
      workMode: form.workMode,
      employmentTypeId: form.employmentTypeId || undefined,
    };
    if (!canManagePay) return base;
    // Currency must be a full 3-letter code (DB CHECK) — a partial entry is
    // treated as "unset" so the row keeps its existing / default currency.
    const currency = form.currency.trim().toUpperCase();
    return {
      ...base,
      hourlyRate: parseRate(form.hourlyRate),
      monthlySalary: parseRate(form.monthlySalary),
      currency: currency.length === 3 ? currency : undefined,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (isEdit && employee) {
      setSubmitting(true);
      try {
        // Real write-through: name/email/title → profiles, dept/team/mode →
        // employees, pay rates → employee_compensation (payroll managers only).
        await mgmt.edit(employee, buildEditInput());
        toast.success("Employee updated", { description: form.name });
        onOpenChange(false);
      } catch (err) {
        toast.error("Couldn't update employee", { description: getErrorMessage(err) });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Real create: provision the auth user + profile + role + employees row on
    // the server (also emails the setup link), then persist the remaining
    // fields (job title / team / work mode) via the same path Edit uses.
    setSubmitting(true);
    try {
      const result = await inviteEmployeeFn({
        data: {
          email: form.email,
          role: form.role,
          department: form.department,
          fullName: form.name,
          positionTitle: form.jobTitle || undefined,
          employmentTypeId: form.employmentTypeId || undefined,
          redirectTo: acceptInvitationRedirectUrl(),
        },
      });
      await mgmt.edit(
        { id: result.employeeId, userId: result.userId, name: form.name },
        buildEditInput(),
      );
      recordAudit({
        action: "employee_created",
        target: form.name.trim(),
        targetType: "employee",
        newValue: `${form.department} · ${form.role}`,
      });
      toast.success("Employee created", { description: form.name });
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't create employee", { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
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
          <div className="space-y-1.5">
            <Label htmlFor="emp-employment-type">Employment type</Label>
            <Select value={form.employmentTypeId} onValueChange={(v) => set("employmentTypeId", v)}>
              <SelectTrigger id="emp-employment-type">
                <SelectValue placeholder="Select employment type" />
              </SelectTrigger>
              <SelectContent>
                {employmentTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Part-time works a 4-hour day and skips the midday report.
            </p>
          </div>
          {/* Pay rates — payroll managers only. Full-time is salaried; everyone
              else is paid hourly, matching how the payroll report calculates. */}
          {canManagePay ? (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs font-medium text-muted-foreground">Compensation</Label>
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                {paysMonthly ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-monthly-salary">Monthly salary</Label>
                    <Input
                      id="emp-monthly-salary"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 15000"
                      value={form.monthlySalary}
                      onChange={(e) => set("monthlySalary", e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-hourly-rate">Hourly rate</Label>
                    <Input
                      id="emp-hourly-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 120"
                      value={form.hourlyRate}
                      onChange={(e) => set("hourlyRate", e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="emp-currency">Currency</Label>
                  <Input
                    id="emp-currency"
                    maxLength={3}
                    placeholder="EGP"
                    className="uppercase"
                    value={form.currency}
                    onChange={(e) => set("currency", e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {paysMonthly
                  ? "Drives base pay on the month-end payroll report. Leave blank for “no rate”."
                  : "Paid per hour worked on the payroll report. Leave blank for “no rate”."}
              </p>
            </div>
          ) : null}
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

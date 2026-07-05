import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { departments, type Department, type EmployeeRole, type HrEmployee } from "../mock-data";
import {
  assignManager,
  assignRole,
  assignTeam,
  changeDepartment,
  deactivateEmployee,
  isSoftDeleted,
  reactivateEmployee,
  resetPassword,
  restoreEmployee,
  softDeleteEmployee,
  suspendEmployee,
} from "../employees-store";
import { recordAudit } from "@/features/audit/audit-store";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { ROLE_OPTIONS } from "./employee-role-options";

const NONE = "__none__";

type AssignKind = "department" | "manager" | "team" | "role";
type ConfirmKind = "reset" | "deactivate" | "suspend" | "delete" | "restore";

export function EmployeeActionsMenu({
  employee,
  employees,
  variant = "icon",
}: {
  employee: HrEmployee;
  /** The full (merged) list — powers manager/team option lists. */
  employees: HrEmployee[];
  variant?: "icon" | "button";
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [assign, setAssign] = useState<AssignKind | null>(null);
  const [assignValue, setAssignValue] = useState<string>("");
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  const isDeleted = isSoftDeleted(employee.id);
  const managerOptions = useMemo(
    () => employees.filter((e) => e.id !== employee.id),
    [employees, employee.id],
  );
  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.team && e.team !== "—") set.add(e.team);
    if (employee.team && employee.team !== "—") set.add(employee.team);
    return [...set].sort();
  }, [employees, employee.team]);

  function openAssign(kind: AssignKind) {
    setAssign(kind);
    setAssignValue(
      kind === "department"
        ? employee.department
        : kind === "manager"
          ? (employee.managerId ?? NONE)
          : kind === "team"
            ? employee.team
            : employee.role,
    );
  }

  function submitAssign() {
    if (!assign) return;
    switch (assign) {
      case "department":
        changeDepartment(employee.id, assignValue as Department);
        toast.success("Department changed", { description: `${employee.name} → ${assignValue}` });
        break;
      case "manager": {
        const managerId = assignValue === NONE ? null : assignValue;
        const managerName = managerOptions.find((e) => e.id === managerId)?.name;
        assignManager(employee.id, managerId, managerName);
        toast.success("Manager assigned", {
          description: managerId ? `${employee.name} → ${managerName}` : "Manager cleared",
        });
        break;
      }
      case "team":
        assignTeam(employee.id, assignValue);
        toast.success("Team assigned", { description: `${employee.name} → ${assignValue}` });
        break;
      case "role":
        recordAudit({
          action: "role_changed",
          target: employee.name,
          targetType: "employee",
          oldValue: employee.role,
          newValue: assignValue,
        });
        assignRole(employee.id, assignValue as EmployeeRole);
        toast.success("Role assigned", { description: `${employee.name} → ${assignValue}` });
        break;
    }
    setAssign(null);
  }

  function runConfirm() {
    switch (confirm) {
      case "reset":
        resetPassword(employee.id, employee.email);
        toast.success("Password reset email sent", { description: employee.email });
        break;
      case "deactivate":
        deactivateEmployee(employee.id);
        toast.message("Employee deactivated", { description: employee.name });
        break;
      case "suspend":
        suspendEmployee(employee.id);
        toast.message("Account suspended", { description: employee.name });
        break;
      case "delete":
        recordAudit({
          action: "employee_deleted",
          target: employee.name,
          targetType: "employee",
          oldValue: employee.status,
        });
        softDeleteEmployee(employee.id);
        toast.message("Employee removed", { description: `${employee.name} was soft-deleted` });
        break;
      case "restore":
        restoreEmployee(employee.id);
        toast.success("Employee restored", { description: employee.name });
        break;
    }
    setConfirm(null);
  }

  const confirmCopy: Record<
    ConfirmKind,
    { title: string; body: string; action: string; destructive?: boolean }
  > = {
    reset: {
      title: "Send password reset?",
      body: `A password reset email will be sent to ${employee.email}.`,
      action: "Send reset email",
    },
    deactivate: {
      title: "Deactivate employee?",
      body: `${employee.name} will lose access but their record is kept. You can reactivate them later.`,
      action: "Deactivate",
      destructive: true,
    },
    suspend: {
      title: "Suspend account?",
      body: `${employee.name}'s account will be put on hold. Reactivate to restore access.`,
      action: "Suspend",
      destructive: true,
    },
    delete: {
      title: "Delete employee?",
      body: `${employee.name} will be removed from the directory. This is a soft delete — the record is retained and can be restored.`,
      action: "Delete",
      destructive: true,
    },
    restore: {
      title: "Restore employee?",
      body: `${employee.name} will be returned to the directory.`,
      action: "Restore",
    },
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button variant="ghost" size="icon" aria-label={`Actions for ${employee.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          ) : (
            <Button variant="outline" className="gap-2">
              <Settings2 className="size-4" /> Manage
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit employee</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAssign("department")}>
            Change department
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAssign("manager")}>Assign manager</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAssign("team")}>Assign team</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAssign("role")}>Assign role</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirm("reset")}>Reset password</DropdownMenuItem>
          <DropdownMenuSeparator />
          {isDeleted ? (
            <DropdownMenuItem onClick={() => setConfirm("restore")}>Restore</DropdownMenuItem>
          ) : (
            <>
              {employee.status === "deactivated" || employee.status === "suspended" ? (
                <DropdownMenuItem onClick={() => reactivateEmployee(employee.id)}>
                  Reactivate
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setConfirm("deactivate")}>
                    Deactivate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirm("suspend")}>
                    Suspend account
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirm("delete")}
              >
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={employee} />

      {/* Assign / change dialogs (single reusable Select dialog). */}
      <Dialog open={assign !== null} onOpenChange={(o) => !o && setAssign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assign === "department" && "Change department"}
              {assign === "manager" && "Assign manager"}
              {assign === "team" && "Assign team"}
              {assign === "role" && "Assign role"}
            </DialogTitle>
            <DialogDescription>{employee.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="assign-select">
              {assign === "department" && "Department"}
              {assign === "manager" && "Manager"}
              {assign === "team" && "Team"}
              {assign === "role" && "Role"}
            </Label>
            <Select value={assignValue} onValueChange={setAssignValue}>
              <SelectTrigger id="assign-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assign === "department" &&
                  departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                {assign === "manager" && (
                  <>
                    <SelectItem value={NONE}>None</SelectItem>
                    {managerOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {assign === "team" &&
                  teamOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                {assign === "role" &&
                  ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssign(null)}>
              Cancel
            </Button>
            <Button onClick={submitAssign}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmations (reset / deactivate / suspend / delete / restore). */}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          {confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmCopy[confirm].title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmCopy[confirm].body}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={runConfirm}
                  className={
                    confirmCopy[confirm].destructive
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                >
                  {confirmCopy[confirm].action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

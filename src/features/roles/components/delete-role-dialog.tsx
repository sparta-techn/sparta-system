import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rbacRepository } from "@/repositories/rbac";
import type { RbacRoleSummary } from "@/services/rbac";

import { warningsForDelete } from "../lockout";
import { roleImpactQuery, roleKeys } from "../queries";
import { LockoutWarningList } from "./lockout-warning";

interface DeleteRoleDialogProps {
  role: RbacRoleSummary | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful delete (e.g. to navigate away from the editor). */
  onDeleted?: () => void;
}

/**
 * Confirmation for deleting a role.
 *
 * Protected roles never reach this dialog — the list hides the action — but the
 * real enforcement is `rbac_delete_role()` rejecting them server-side, which in
 * turn sits on top of the Phase 1 database trigger.
 *
 * When users are still assigned, the dialog states how many will lose the role,
 * shows which permissions they lose outright, and requires the role name to be
 * typed before the destructive action unlocks.
 */
export function DeleteRoleDialog({ role, onOpenChange, onDeleted }: DeleteRoleDialogProps) {
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState("");

  const open = role !== null;
  const { data: impact = [] } = useQuery(roleImpactQuery(role?.id ?? "", open && !!role));
  const warnings = warningsForDelete(impact);

  const mutation = useMutation({
    mutationFn: () => rbacRepository.deleteRole(role!.id),
    onSuccess: (unassigned) => {
      toast.success(
        unassigned > 0
          ? `Role deleted — removed from ${unassigned} ${unassigned === 1 ? "user" : "users"}.`
          : "Role deleted.",
      );
      void queryClient.invalidateQueries({ queryKey: roleKeys.all });
      close();
      onDeleted?.();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete the role."),
  });

  const close = () => {
    setConfirmation("");
    onOpenChange(false);
  };

  if (!role) return null;

  const hasUsers = role.user_count > 0;
  // Typing the name is only demanded when real users are affected; deleting an
  // unused role should not need ceremony.
  const confirmed = !hasUsers || confirmation.trim() === role.name;

  return (
    <AlertDialog open={open} onOpenChange={(v) => (v ? undefined : close())}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{role.name}”?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {hasUsers ? (
                  <>
                    <span className="font-medium text-foreground">
                      {role.user_count} {role.user_count === 1 ? "user" : "users"}
                    </span>{" "}
                    will lose this role, along with the{" "}
                    <span className="font-medium text-foreground">{role.permission_count}</span>{" "}
                    permissions it grants. This cannot be undone.
                  </>
                ) : (
                  <>
                    No users hold this role. Its {role.permission_count} permission grants will be
                    removed. This cannot be undone.
                  </>
                )}
              </p>
              {warnings.length > 0 ? (
                <LockoutWarningList
                  warnings={warnings}
                  title="Deleting this role removes access that no other role replaces"
                />
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasUsers ? (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-role-name" className="text-xs">
              Type <span className="font-mono font-medium">{role.name}</span> to confirm
            </Label>
            <Input
              id="confirm-role-name"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              placeholder={role.name}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!confirmed || mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Delete role
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { rbacRepository } from "@/repositories/rbac";

import { moduleLabel, actionLabel, SCOPE_LABELS } from "../permission-tree";
import {
  effectivePermissionsQuery,
  roleKeys,
  roleSummariesQuery,
  userRolesQuery,
} from "../queries";
import { useDynamicPermissions } from "../use-dynamic-permission";

interface UserRolesPanelProps {
  /** `auth.users.id` — i.e. `profiles.id` / `employees.user_id`. */
  userId: string;
  /** Shown in the empty state, e.g. "Dana Reyes". */
  displayName?: string;
}

/**
 * Per-user role assignment plus a live effective-permissions summary.
 *
 * A user may hold several roles; their access is the UNION of all of them, so
 * the role chips alone don't tell an admin what someone can actually do. The
 * summary below resolves that union server-side
 * (`rbac_effective_permissions()` — one grouped query, not one per role) and
 * annotates each permission with the roles that grant it.
 */
export function UserRolesPanel({ userId, displayName }: UserRolesPanelProps) {
  const queryClient = useQueryClient();
  const { can } = useDynamicPermissions();
  const canAssign = can("roles", "assign", "all");
  const [adding, setAdding] = useState("");

  const { data: assigned = [], isLoading } = useQuery(userRolesQuery(userId, !!userId));
  const { data: effective = [], isLoading: loadingEffective } = useQuery(
    effectivePermissionsQuery(userId, !!userId),
  );
  const { data: allRoles = [] } = useQuery({
    ...roleSummariesQuery(),
    // Only role managers can list every role; everyone else just sees the chips.
    enabled: canAssign,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: roleKeys.all });
  };

  const assign = useMutation({
    mutationFn: (roleId: string) => rbacRepository.assignRole(userId, roleId),
    onSuccess: () => {
      toast.success("Role assigned.");
      setAdding("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to assign the role."),
  });

  const unassign = useMutation({
    mutationFn: (roleId: string) => rbacRepository.unassignRole(userId, roleId),
    onSuccess: () => {
      toast.success("Role removed.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove the role."),
  });

  const assignedIds = useMemo(() => new Set(assigned.map((r) => r.role_id)), [assigned]);
  const available = allRoles.filter((r) => !assignedIds.has(r.id));

  // Group the union by module for a scannable summary.
  const byModule = useMemo(() => {
    const map = new Map<string, typeof effective>();
    for (const p of effective) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return [...map.entries()].sort((a, b) => moduleLabel(a[0]).localeCompare(moduleLabel(b[0])));
  }, [effective]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4" />
            Assigned roles
            <Badge variant="secondary">{assigned.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-8 w-64" />
          ) : assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {displayName ?? "This user"} holds no dynamic roles yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assigned.map((role) => (
                <span
                  key={role.role_id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-surface py-1 pl-3 pr-1.5 text-sm"
                >
                  {role.is_protected ? <Lock className="size-3 text-primary" /> : null}
                  {role.name}
                  {canAssign ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 rounded-full"
                      disabled={unassign.isPending}
                      onClick={() => unassign.mutate(role.role_id)}
                    >
                      <X className="size-3" />
                      <span className="sr-only">Remove {role.name}</span>
                    </Button>
                  ) : null}
                </span>
              ))}
            </div>
          )}

          {canAssign ? (
            <div className="flex items-center gap-2">
              <Select value={adding} onValueChange={setAdding} disabled={available.length === 0}>
                <SelectTrigger className="h-8 w-64 text-xs">
                  <SelectValue
                    placeholder={available.length === 0 ? "All roles assigned" : "Add a role…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {available.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!adding || assign.isPending}
                onClick={() => assign.mutate(adding)}
              >
                {assign.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 size-4" />
                )}
                Assign
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Effective permissions
            {effective.length > 0 ? (
              <Badge variant="secondary" className="ml-2 tabular-nums">
                {effective.length}
              </Badge>
            ) : null}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            The union across every assigned role — what this user can actually do.
          </p>
        </CardHeader>
        <CardContent>
          {loadingEffective ? (
            <Skeleton className="h-32 w-full" />
          ) : effective.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No permissions. {displayName ?? "This user"} has no access through the dynamic role
              system.
            </p>
          ) : (
            <div className="space-y-3">
              {byModule.map(([module, perms]) => (
                <div key={module} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{moduleLabel(module)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.map((p) => (
                      <Tooltip key={`${p.module}.${p.action}.${p.scope}`}>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="font-normal">
                            {actionLabel(p.action)}
                            <span className="ml-1 text-muted-foreground">
                              · {SCOPE_LABELS[p.scope]}
                            </span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Granted by {p.granted_by.join(", ")}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

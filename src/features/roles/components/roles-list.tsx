import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Lock, Pencil, Plus, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RbacRoleSummary } from "@/services/rbac";

import { useDynamicPermissions } from "../use-dynamic-permission";
import { roleSummariesQuery } from "../queries";
import { DeleteRoleDialog } from "./delete-role-dialog";

/**
 * The roles table.
 *
 * Permission and user counts come pre-aggregated from `rbac_role_summaries()`
 * in a single round trip — the list never issues a count query per row.
 */
export function RolesList() {
  const { can } = useDynamicPermissions();
  const { data: roles = [], isLoading, isError } = useQuery(roleSummariesQuery());
  const [pendingDelete, setPendingDelete] = useState<RbacRoleSummary | null>(null);

  const canCreate = can("roles", "create", "all");
  const canEdit = can("roles", "edit", "all");
  const canDelete = can("roles", "delete", "all");

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Couldn’t load roles. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {roles.length} {roles.length === 1 ? "role" : "roles"}. Permissions union across every
          role a user holds.
        </p>
        {canCreate ? (
          <Button asChild size="sm">
            <Link to="/app/roles/new">
              <Plus className="mr-1.5 size-4" />
              New role
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="w-32 text-right">Permissions</TableHead>
                <TableHead className="w-28 text-right">Users</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.name}</span>
                      {role.is_protected ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="gap-1 border-primary/40 text-primary"
                            >
                              <Lock className="size-3" />
                              Protected
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Built-in role. Its permissions cannot be modified and it cannot be
                            deleted.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    {role.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1.5 tabular-nums text-sm">
                      <KeyRound className="size-3.5 text-muted-foreground" />
                      {role.permission_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1.5 tabular-nums text-sm">
                      <Users className="size-3.5 text-muted-foreground" />
                      {role.user_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Open role"
                      >
                        <Link to="/app/roles/$id" params={{ id: role.id }}>
                          <Pencil className="size-4" />
                          <span className="sr-only">
                            {canEdit && !role.is_protected ? "Edit" : "View"} {role.name}
                          </span>
                        </Link>
                      </Button>
                      {/* Protected roles render no delete affordance at all. */}
                      {canDelete && !role.is_protected ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Delete role"
                          onClick={() => setPendingDelete(role)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                          <span className="sr-only">Delete {role.name}</span>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DeleteRoleDialog role={pendingDelete} onOpenChange={() => setPendingDelete(null)} />
    </div>
  );
}

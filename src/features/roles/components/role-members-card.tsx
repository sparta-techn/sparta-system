import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { rbacRepository } from "@/repositories/rbac";

import { assignableUsersQuery, roleKeys, roleMembersQuery } from "../queries";
import { useDynamicPermissions } from "../use-dynamic-permission";

interface RoleMembersCardProps {
  roleId: string;
  roleName: string;
}

/**
 * Membership management from the ROLE side.
 *
 * The employee profile's Permissions tab handles "which roles does this person
 * have"; this is the inverse — "who has this role" — which is how an admin
 * naturally thinks when they have just finished defining a role.
 *
 * Assignment is idempotent server-side and requires `roles.assign`; without it
 * the card is read-only.
 */
export function RoleMembersCard({ roleId, roleName }: RoleMembersCardProps) {
  const queryClient = useQueryClient();
  const { can } = useDynamicPermissions();
  const canAssign = can("roles", "assign", "all");

  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);

  const { data: members = [], isLoading } = useQuery(roleMembersQuery(roleId));
  const { data: candidates = [], isFetching: searching } = useQuery(
    assignableUsersQuery(roleId, search, canAssign && picking),
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: roleKeys.all });
  };

  const assign = useMutation({
    mutationFn: (userId: string) => rbacRepository.assignRole(userId, roleId),
    onSuccess: () => {
      toast.success(`Added to ${roleName}.`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to assign the role."),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => rbacRepository.unassignRole(userId, roleId),
    onSuccess: () => {
      toast.success(`Removed from ${roleName}.`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove the role."),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4" />
          Members
          <Badge variant="secondary" className="tabular-nums">
            {members.length}
          </Badge>
        </CardTitle>
        {canAssign ? (
          <Button
            size="sm"
            variant={picking ? "secondary" : "outline"}
            onClick={() => {
              setPicking((v) => !v);
              setSearch("");
            }}
          >
            <UserPlus className="mr-1.5 size-4" />
            {picking ? "Done" : "Add people"}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {picking ? (
          <div className="space-y-2 rounded-lg border bg-surface/60 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="h-8 pl-7 text-xs"
                autoFocus
              />
            </div>

            {searching ? (
              <Skeleton className="h-8 w-full" />
            ) : candidates.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {search ? `Nobody matches “${search}”.` : "Everyone already holds this role."}
              </p>
            ) : (
              <ul className="max-h-64 divide-y overflow-y-auto">
                {candidates.map((u) => (
                  <li key={u.user_id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{u.display_name ?? u.email}</p>
                      {u.display_name && u.email ? (
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0"
                      disabled={assign.isPending}
                      onClick={() => assign.mutate(u.user_id)}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Showing at most 50 matches. A person can hold several roles — their access is the
              union.
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody holds this role yet.
            {canAssign ? " Use “Add people” to assign it." : null}
          </p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{m.display_name ?? m.email}</p>
                  {m.display_name && m.email ? (
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  ) : null}
                </div>
                {canAssign ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(m.user_id)}
                  >
                    <X className="size-4" />
                    <span className="sr-only">Remove {m.display_name ?? m.email}</span>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Roles can also be assigned per person from the{" "}
          <Link to="/app/hr/employees" className="underline underline-offset-2">
            directory
          </Link>{" "}
          → Permissions tab.
        </p>
      </CardContent>
    </Card>
  );
}

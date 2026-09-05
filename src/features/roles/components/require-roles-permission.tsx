import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PermissionScope } from "@/services/rbac";

import { useDynamicPermissions } from "../use-dynamic-permission";

interface RequireRolesPermissionProps {
  /** Action within the `roles` module the screen needs, e.g. "view" / "edit". */
  action: string;
  scope?: PermissionScope;
  children: ReactNode;
}

/**
 * Client-side gate for the role management screens, driven by the *dynamic*
 * `has_permission()` engine (module `roles`).
 *
 * This is a UX affordance only. Every read and write behind it is a SECURITY
 * DEFINER RPC that re-checks the same permission inside Postgres, so a user who
 * bypasses this component still cannot read or change anything.
 */
export function RequireRolesPermission({
  action,
  scope = "all",
  children,
}: RequireRolesPermissionProps) {
  const { loading, can } = useDynamicPermissions();

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!can("roles", action, scope)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">You don’t have access to role management</p>
          <p className="max-w-md text-xs text-muted-foreground">
            This area requires the <span className="font-medium">Roles &amp; permissions</span> ·{" "}
            <span className="font-medium">{action}</span> permission. Ask an administrator to assign
            you a role that grants it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

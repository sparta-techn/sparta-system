import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { hasCriticalWarning, summarize, type LockoutWarning } from "../lockout";

interface LockoutWarningListProps {
  warnings: LockoutWarning[];
  /** Overrides the default heading (e.g. for the delete dialog). */
  title?: string;
}

/**
 * The soft lockout warning.
 *
 * Shown when a pending change would strip a permission from users who have no
 * other role granting it. Deliberately advisory: the protected Owner role
 * always keeps the full catalog, so this can never be a true lockout — but an
 * admin should still see who they are about to cut off.
 */
export function LockoutWarningList({ warnings, title }: LockoutWarningListProps) {
  if (warnings.length === 0) return null;
  const critical = hasCriticalWarning(warnings);
  const summary = summarize(warnings);

  return (
    <Alert variant={critical ? "destructive" : "default"} className="text-left">
      <AlertTriangle className="size-4" />
      <AlertTitle>{title ?? "This removes access for existing users"}</AlertTitle>
      <AlertDescription className="space-y-2">
        {summary ? <p>{summary}</p> : null}
        <ul className="space-y-1">
          {warnings.slice(0, 8).map((w) => (
            <li key={w.permissionId} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">
                {w.label}
                {w.critical ? (
                  <Badge variant="outline" className="ml-2 align-middle">
                    administrative
                  </Badge>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {w.usersLosing} {w.usersLosing === 1 ? "user" : "users"}
              </span>
            </li>
          ))}
        </ul>
        {warnings.length > 8 ? (
          <p className="text-xs text-muted-foreground">
            …and {warnings.length - 8} more permission{warnings.length - 8 === 1 ? "" : "s"}.
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

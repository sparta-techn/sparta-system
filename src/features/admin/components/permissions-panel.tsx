import { useMemo } from "react";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, ENTERPRISE_ROLES } from "@/features/auth/types";
import { PERMISSION_CATALOG, ROLE_PERMISSIONS } from "@/features/auth/permissions";

/**
 * Read-only role → permission matrix, straight from the RBAC catalog
 * (the mirror of RLS intent). Owner can audit exactly what each role grants.
 */
export function PermissionsPanel() {
  const grants = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const role of ENTERPRISE_ROLES) map[role] = new Set(ROLE_PERMISSIONS[role]);
    return map;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Permission matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Permission</TableHead>
                {ENTERPRISE_ROLES.map((role) => (
                  <TableHead key={role} className="text-center text-xs whitespace-nowrap">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSION_CATALOG.map((perm) => (
                <TableRow key={perm.key}>
                  <TableCell className="sticky left-0 bg-card">
                    <div className="min-w-0">
                      <code className="text-xs font-medium">{perm.key}</code>
                      <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                    </div>
                  </TableCell>
                  {ENTERPRISE_ROLES.map((role) => (
                    <TableCell key={role} className="text-center">
                      {grants[role].has(perm.key) ? (
                        <Check className="mx-auto size-4 text-success" aria-label="granted" />
                      ) : (
                        <span className="text-muted-foreground" aria-label="not granted">
                          ·
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

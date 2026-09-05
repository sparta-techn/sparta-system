import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Lock, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { rbacRepository } from "@/repositories/rbac";
import type { RbacRoleSummary } from "@/services/rbac";

import { warningsForRemoval } from "../lockout";
import { removedIds } from "../permission-tree";
import { permissionCatalogQuery, roleEditorQuery, roleKeys, roleSummariesQuery } from "../queries";
import { useDynamicPermissions } from "../use-dynamic-permission";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { LockoutWarningList } from "./lockout-warning";
import { PermissionPicker } from "./permission-picker";
import { RoleMembersCard } from "./role-members-card";

/** Create mode: no role id yet. */
export function RoleCreator() {
  const { can } = useDynamicPermissions();
  const { data: catalog = [], isLoading } = useQuery(permissionCatalogQuery());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: () =>
      rbacRepository.createRole(name.trim(), description.trim() || null, [...selected]),
    onSuccess: (roleId) => {
      toast.success("Role created.");
      void queryClient.invalidateQueries({ queryKey: roleKeys.all });
      void navigate({ to: "/app/roles/$id", params: { id: roleId } });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create the role."),
  });

  if (!can("roles", "create", "all")) {
    return (
      <Alert>
        <AlertDescription>You don’t have permission to create roles.</AlertDescription>
      </Alert>
    );
  }

  return (
    <EditorShell
      title="New role"
      name={name}
      description={description}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      catalog={catalog}
      catalogLoading={isLoading}
      selected={selected}
      onSelectedChange={setSelected}
      readOnly={false}
      saving={mutation.isPending}
      canSave={name.trim().length > 0}
      onSave={() => mutation.mutate()}
      saveLabel="Create role"
    />
  );
}

/** Edit mode for an existing role. */
export function RoleEditor({ roleId }: { roleId: string }) {
  const { can } = useDynamicPermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery(roleEditorQuery(roleId));
  const { data: summaries = [] } = useQuery(roleSummariesQuery());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<RbacRoleSummary | null>(null);

  // Seed local form state once the role loads (and whenever a different role
  // is opened). Server data stays the source of truth for the baseline.
  useEffect(() => {
    if (!data) return;
    setName(data.role.name);
    setDescription(data.role.description ?? "");
    setSelected(new Set(data.permissionIds));
  }, [data]);

  const protectedRole = data?.role.is_protected ?? false;
  const canEdit = can("roles", "edit", "all") && !protectedRole;
  const canDelete = can("roles", "delete", "all") && !protectedRole;

  // Which currently-granted permissions the pending save would revoke, and who
  // that would actually cut off. Impact comes from the DB, not a client guess.
  const warnings = useMemo(() => {
    if (!data || protectedRole) return [];
    return warningsForRemoval(removedIds(data.permissionIds, selected), data.impact);
  }, [data, selected, protectedRole]);

  const dirty = useMemo(() => {
    if (!data) return false;
    if (name !== data.role.name) return true;
    if (description !== (data.role.description ?? "")) return true;
    if (selected.size !== data.permissionIds.length) return true;
    return data.permissionIds.some((id) => !selected.has(id));
  }, [data, name, description, selected]);

  const mutation = useMutation({
    mutationFn: () =>
      rbacRepository.saveRole(roleId, name.trim(), description.trim() || null, [...selected]),
    onSuccess: () => {
      toast.success("Role saved.");
      void queryClient.invalidateQueries({ queryKey: roleKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save the role."),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Couldn’t load this role.</AlertDescription>
      </Alert>
    );
  }

  const summary = summaries.find((s) => s.id === roleId) ?? null;

  return (
    <>
      <EditorShell
        title={data.role.name}
        protectedRole={protectedRole}
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        catalog={data.catalog}
        catalogLoading={false}
        selected={selected}
        onSelectedChange={setSelected}
        readOnly={!canEdit}
        saving={mutation.isPending}
        canSave={canEdit && dirty && name.trim().length > 0}
        onSave={() => mutation.mutate()}
        saveLabel="Save changes"
        warnings={warnings}
        onDelete={canDelete && summary ? () => setPendingDelete(summary) : undefined}
        userCount={summary?.user_count}
        members={<RoleMembersCard roleId={roleId} roleName={data.role.name} />}
      />
      <DeleteRoleDialog
        role={pendingDelete}
        onOpenChange={() => setPendingDelete(null)}
        onDeleted={() => void navigate({ to: "/app/roles" })}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

interface EditorShellProps {
  title: string;
  protectedRole?: boolean;
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  catalog: Parameters<typeof PermissionPicker>[0]["catalog"];
  catalogLoading: boolean;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  readOnly: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  saveLabel: string;
  warnings?: ReturnType<typeof warningsForRemoval>;
  onDelete?: () => void;
  userCount?: number;
  /** Membership card; absent in create mode, where the role does not exist yet. */
  members?: ReactNode;
}

/** Shared chrome for both create and edit modes. */
function EditorShell({
  title,
  protectedRole = false,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  catalog,
  catalogLoading,
  selected,
  onSelectedChange,
  readOnly,
  saving,
  canSave,
  onSave,
  saveLabel,
  warnings = [],
  onDelete,
  userCount,
  members,
}: EditorShellProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
          <Link to="/app/roles">
            <ChevronLeft className="size-4" /> All roles
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {/* Protected roles render no delete button at all — and the RPC would
              reject one anyway. */}
          {onDelete ? (
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1.5 size-4 text-destructive" />
              Delete
            </Button>
          ) : null}
          {protectedRole ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" disabled>
                    <Lock className="mr-1.5 size-4" />
                    Protected
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Owner role permissions cannot be modified. This is enforced by the database, not
                just this screen.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button size="sm" disabled={!canSave || saving} onClick={onSave}>
              {saving ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-4" />
              )}
              {saveLabel}
            </Button>
          )}
        </div>
      </div>

      {protectedRole ? (
        <Alert>
          <Lock className="size-4" />
          <AlertDescription>
            <span className="font-medium">“{title}” is a protected role.</span> Its permission list
            is read-only and it cannot be deleted, so there is always an account that retains full
            access. The database rejects any attempt to change it, including direct API calls.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            Details
            {typeof userCount === "number" ? (
              <Badge variant="secondary">
                {userCount} {userCount === 1 ? "user" : "users"}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              // A protected role's name is immutable; its description is not.
              disabled={protectedRole}
              maxLength={64}
              placeholder="e.g. Payroll Reviewer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              disabled={readOnly && !protectedRole}
              rows={2}
              placeholder="What this role is for"
            />
          </div>
        </CardContent>
      </Card>

      {members}

      {warnings.length > 0 ? <LockoutWarningList warnings={warnings} /> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {catalogLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PermissionPicker
              catalog={catalog}
              selected={selected}
              onChange={onSelectedChange}
              disabled={readOnly}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

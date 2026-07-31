import { useState } from "react";
import { Archive, Copy, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { canDeleteProject } from "@/services/projects/rules";
import {
  archiveProject,
  deleteProject,
  duplicateProject,
  updateProject,
  useProjectsState,
} from "../store";
import type { Project, ProjectHealth, ProjectStatus } from "../types";

/**
 * Selectable lifecycle values. The `value` of each entry is the **stored**
 * `project_status` enum value — the label is display-only and never persisted.
 */
const STATUS_OPTIONS: ReadonlyArray<{ value: ProjectStatus; label: string }> = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Selectable health values — an explicit list, deliberately **not** derived from
 * the `project_health` enum.
 *
 * The enum also carries `completed`, which duplicates a *status* concept on the
 * health axis (a project's health answers "is this in trouble?", not "is this
 * finished?"). It is excluded here so the UI stops writing new rows with it. The
 * enum itself is left intact — removing the value is a separate migration.
 */
const HEALTH_OPTIONS: ReadonlyArray<{ value: ProjectHealth; label: string }> = [
  { value: "healthy", label: "Healthy" },
  { value: "at_risk", label: "At risk" },
  { value: "blocked", label: "Blocked" },
  { value: "delayed", label: "Delayed" },
];

export function ProjectSettingsTab({ project }: { project: Project }) {
  const navigate = useNavigate();
  const people = useProjectsState((s) => s.people);
  const { roles } = useAuth();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [managerId, setManagerId] = useState(project.managerId);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [health, setHealth] = useState<ProjectHealth>(project.health);
  const [repo, setRepo] = useState(project.repositoryUrl ?? "");
  const [figma, setFigma] = useState(project.figmaUrl ?? "");
  const [docs, setDocs] = useState(project.apiDocsUrl ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canDelete = canDeleteProject(roles);

  function save() {
    updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      managerId,
      status,
      health,
      repositoryUrl: repo || undefined,
      figmaUrl: figma || undefined,
      apiDocsUrl: docs || undefined,
    });
  }

  async function onDuplicate() {
    try {
      const copy = await duplicateProject(project.id);
      if (copy) navigate({ to: "/app/projects/$id", params: { id: copy.id } });
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : "Please try again.";
      toast.error(`Couldn't duplicate the project. ${detail}`);
    }
  }

  function onArchive() {
    if (!confirm(`Archive ${project.name}? It will be hidden from the active list.`)) return;
    archiveProject(project.id);
    navigate({ to: "/app/projects/all" });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <h2 className="text-base font-semibold">General</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Project manager">
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {people.slice(0, 30).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Health">
            <Select value={health} onValueChange={(v) => setHealth(v as ProjectHealth)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
                {/* Legacy rows may still hold `completed`. Keep it selectable so
                    opening settings doesn't blank the field or silently rewrite
                    the stored value — it just isn't offered as a new choice. */}
                {!HEALTH_OPTIONS.some((o) => o.value === health) && (
                  <SelectItem value={health}>{health} (legacy)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Repository URL">
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} />
          </Field>
          <Field label="Figma URL">
            <Input value={figma} onChange={(e) => setFigma(e.target.value)} />
          </Field>
          <Field label="API documentation">
            <Input value={docs} onChange={(e) => setDocs(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={save}>Save changes</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="text-base font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={onDuplicate}>
            <Copy className="size-4" /> Duplicate
          </Button>
          <Button variant="outline" className="gap-2" onClick={onArchive}>
            <Archive className="size-4" /> Archive
          </Button>
        </div>
      </Card>

      <Card className="p-4 border-destructive/40">
        <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleting a project removes it and all its data. This cannot be undone.
        </p>
        <Button
          variant="destructive"
          className="mt-3 gap-2"
          disabled={!canDelete}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" />
          {canDelete ? "Delete project" : "Delete project (requires Owner)"}
        </Button>
      </Card>

      <DeleteProjectDialog
        project={project}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDeleted={() => navigate({ to: "/app/projects/all" })}
      />
    </div>
  );
}

/**
 * Permanent-delete confirmation. Requires the project name to be typed exactly
 * before the destructive action unlocks.
 */
function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const confirmed = typed === project.name;

  function close(next: boolean) {
    if (deleting) return;
    if (!next) setTyped("");
    onOpenChange(next);
  }

  async function runDelete() {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success("Project deleted", { description: project.name });
      onOpenChange(false);
      setTyped("");
      onDeleted();
    } catch (err) {
      // Covers both failure modes: a thrown ServiceError (RLS/PostgREST error)
      // and DeleteAffectedNoRowsError, which is what a zero-row delete raises
      // now that the service chains `.select()`. Neither is allowed to be silent.
      toast.error("Couldn't delete project", {
        description: err instanceof Error && err.message ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the project and everything attached to it — tasks, epics,
            milestones, risks, members, calendar events and activity. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1">
          <Label htmlFor="confirm-project-name">
            Type <span className="font-semibold text-foreground">{project.name}</span> to confirm
          </Label>
          <Input
            id="confirm-project-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            placeholder={project.name}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!confirmed || deleting}
            onClick={runDelete}
            className="gap-2"
          >
            <Trash2 className="size-4" />
            {deleting ? "Deleting…" : "Delete project"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

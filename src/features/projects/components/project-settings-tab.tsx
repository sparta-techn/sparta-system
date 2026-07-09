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
import { archiveProject, duplicateProject, updateProject, useProjectsState } from "../store";
import type { Project } from "../types";

export function ProjectSettingsTab({ project }: { project: Project }) {
  const navigate = useNavigate();
  const people = useProjectsState((s) => s.people);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [managerId, setManagerId] = useState(project.managerId);
  const [repo, setRepo] = useState(project.repositoryUrl ?? "");
  const [figma, setFigma] = useState(project.figmaUrl ?? "");
  const [docs, setDocs] = useState(project.apiDocsUrl ?? "");

  function save() {
    updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      managerId,
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
        <Button variant="destructive" className="mt-3 gap-2" disabled>
          <Trash2 className="size-4" /> Delete project (requires Owner)
        </Button>
      </Card>
    </div>
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

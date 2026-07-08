import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEPARTMENTS, PEOPLE, PROJECTS } from "../mock-data";
import { dependencyStore } from "../store";
import {
  DEPENDENCY_PRIORITIES,
  DEPENDENCY_TYPES,
  PRIORITY_LABEL,
  TYPE_LABEL,
  type DependencyPriority,
  type DependencyType,
} from "../types";

export function DepCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<DependencyType>("backend_api");
  const [priority, setPriority] = useState<DependencyPriority>("medium");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [ownerId, setOwnerId] = useState<string>("none");
  const [project, setProject] = useState(PROJECTS[0]);
  const [relatedTaskRef, setRelatedTaskRef] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [tags, setTags] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setType("backend_api");
    setPriority("medium");
    setDepartment(DEPARTMENTS[0]);
    setOwnerId("none");
    setProject(PROJECTS[0]);
    setRelatedTaskRef("");
    setDueAt("");
    setTags("");
  }

  function submit(asDraft: boolean) {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const dep = dependencyStore.create({
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      department,
      ownerId: ownerId === "none" ? null : ownerId,
      project,
      relatedTaskRef: relatedTaskRef.trim() || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      asDraft,
    });
    toast.success(asDraft ? "Saved as draft" : `Created ${dep.id}`);
    onOpenChange(false);
    reset();
    onCreated?.(dep.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New dependency</DialogTitle>
          <DialogDescription>
            Capture what you need, from whom, and by when. Should take under a minute.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="dep-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dep-title"
              autoFocus
              placeholder="Need /v2/orders endpoint with pagination"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dep-desc">Description</Label>
            <Textarea
              id="dep-desc"
              placeholder="Why is this blocking you? What does ‘done’ look like?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DependencyType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPENDENCY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as DependencyPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPENDENCY_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dep-due">Due date</Label>
              <Input
                id="dep-due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Assigned employee</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {PEOPLE.filter((p) => p.id !== "u-me").map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Related project</Label>
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dep-task">Related task (ClickUp)</Label>
              <Input
                id="dep-task"
                placeholder="CU-1234"
                value={relatedTaskRef}
                onChange={(e) => setRelatedTaskRef(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dep-tags">Tags (comma separated)</Label>
            <Input
              id="dep-tags"
              placeholder="checkout, v3-release"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="rounded-md border border-dashed border-border bg-surface/50 p-3 text-xs text-muted-foreground">
            Attachments coming soon — for now mention files in the description.
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => submit(true)}>
              Save as draft
            </Button>
            <Button type="submit">Create dependency</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

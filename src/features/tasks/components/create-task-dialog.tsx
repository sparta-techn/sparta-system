import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useProjectsState } from "@/features/projects/store";
import { useAuth } from "@/features/auth/auth-context";
import { createTask, useTasksState } from "../store";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "../types";

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultProjectId,
  parentTaskId,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  defaultProjectId?: string;
  parentTaskId?: string | null;
}) {
  const epics = useTasksState((s) => s.epics);
  const milestones = useTasksState((s) => s.milestones);
  const { user } = useAuth();
  const allProjects = useProjectsState((s) => s.projects);
  const people = useProjectsState((s) => s.people);
  // RLS only permits a project member to insert tasks — show only those.
  const memberProjects = allProjects.filter(
    (p) => p.members.some((m) => m.employeeId === user?.id) || p.managerId === user?.id,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [epicId, setEpicId] = useState<string>("none");
  const [milestoneId, setMilestoneId] = useState<string>("none");
  const [dueDate, setDueDate] = useState<string>("");

  const project = allProjects.find((p) => p.id === projectId);
  const projectEpics = epics.filter((e) => e.projectId === projectId);
  const projectMilestones = milestones.filter((m) => m.projectId === projectId);

  // Projects hydrate asynchronously — pick a sensible default once they arrive.
  useEffect(() => {
    if (!projectId && memberProjects.length) {
      setProjectId(defaultProjectId ?? memberProjects[0].id);
    }
  }, [projectId, memberProjects, defaultProjectId]);

  function reset() {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setAssigneeId("none");
    setEpicId("none");
    setMilestoneId("none");
    setDueDate("");
  }

  function submit() {
    if (!title.trim() || !project || !user) return;
    createTask(
      {
        title: title.trim(),
        description,
        projectId,
        reporterId: user.id,
        assigneeId: assigneeId === "none" ? null : assigneeId,
        epicId: epicId === "none" ? null : epicId,
        milestoneId: milestoneId === "none" ? null : milestoneId,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        parentTaskId: parentTaskId ?? null,
      },
      project.key,
    );
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{parentTaskId ? "New subtask" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to happen?"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Markdown supported. Acceptance criteria, context, links…"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <Select value={projectId} onValueChange={setProjectId} disabled={!!parentTaskId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {memberProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.icon} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assignee">
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Epic">
              <Select value={epicId} onValueChange={setEpicId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No epic</SelectItem>
                  {projectEpics.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Milestone">
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No milestone</SelectItem>
                  {projectMilestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            {parentTaskId ? "Add subtask" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

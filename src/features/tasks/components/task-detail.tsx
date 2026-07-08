import { useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useProjectsState } from "@/features/projects/store";
import {
  archiveTask,
  duplicateTask,
  restoreTask,
  toggleFavorite,
  toggleWatcher,
  updateTask,
  useTasksState,
} from "../store";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskLabel,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import { TaskLabelChip, TaskPriorityBadge, TaskStatusBadge } from "./badges";
import { EmployeeChip } from "./employee-chip";
import { TaskChecklist } from "./task-checklist";
import { SubtaskTree } from "./subtask-tree";
import { TaskComments } from "./task-comments";
import { TaskActivityTimeline } from "./task-activity";
import { TaskRowActionsMenu } from "./tasks-list";
import { formatDate, isOverdue, projectById } from "../utils";
import { EmptyState } from "@/features/hr/components/empty-state";
import { Inbox } from "lucide-react";
import { TaskTimeTab } from "@/features/time-tracking/components/task-time-tab";
import { TaskTimeSummary } from "@/features/time-tracking/components/task-time-summary";
import { ThreadedComments } from "@/features/task-communication/components/threaded-comments";
import { TaskFilesPanel } from "@/features/task-communication/components/task-files-panel";
import { CommunicationActivity } from "@/features/task-communication/components/communication-activity";
import { useCommState } from "@/features/task-communication/store";

export function TaskDetail({ taskId }: { taskId: string }) {
  const task = useTasksState((s) => s.tasks.find((t) => t.id === taskId) ?? null);
  const favorites = useTasksState((s) => s.favoriteIds);
  const navigate = useNavigate();
  // Hook must run every render (constant order); it tolerates a nullish id.
  const parent = useTasksStateOptional(task?.parentTaskId);

  if (!task) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/tasks/all" })}>
          <ArrowLeft className="size-4" /> Back to tasks
        </Button>
        <EmptyState
          icon={Inbox}
          title="Task not found"
          description="It may have been deleted or you don't have access."
        />
      </div>
    );
  }

  const project = projectById(task.projectId);
  const overdue = isOverdue(task);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/tasks/all">
              <ArrowLeft className="size-4" /> All tasks
            </Link>
          </Button>
          {parent ? (
            <Link
              to="/app/tasks/$id"
              params={{ id: parent.id }}
              className="text-xs text-muted-foreground hover:underline"
            >
              ↰ Parent: {parent.ref} · {parent.title}
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleFavorite(task.id)}
            aria-label="Favorite"
          >
            <Star
              className={cn(
                "size-4",
                favorites.includes(task.id) ? "fill-amber-400 text-amber-500" : "",
              )}
            />
          </Button>
          <TaskRowActionsMenu
            onDuplicate={() => {
              const copy = duplicateTask(task.id);
              if (copy) navigate({ to: "/app/tasks/$id", params: { id: copy.id } });
            }}
            onArchive={() => (task.archivedAt ? restoreTask(task.id) : archiveTask(task.id))}
            onDelete={() => {
              updateTask(task.id, { deletedAt: new Date().toISOString() });
              navigate({ to: "/app/tasks/all" });
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono uppercase">{task.ref}</span>
              {project ? (
                <Link
                  to="/app/projects/$id"
                  params={{ id: project.id }}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <span aria-hidden>{project.icon}</span>
                  {project.name}
                </Link>
              ) : null}
              {task.archivedAt ? <span className="text-amber-500">Archived</span> : null}
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              {task.labels.map((l) => (
                <TaskLabelChip key={l} label={l} />
              ))}
              {overdue ? (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  Overdue
                </span>
              ) : null}
              <TaskTimeSummary taskId={task.id} />
            </div>
          </Card>

          <Card className="p-5">
            <Tabs defaultValue="overview">
              <TabsList className="flex w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="checklist">
                  Checklist {task.checklist.length ? `· ${task.checklist.length}` : ""}
                </TabsTrigger>
                <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
                <TabsTrigger value="comments">
                  <CommentsTabLabel taskId={task.id} />
                </TabsTrigger>
                <TabsTrigger value="files">
                  <FilesTabLabel taskId={task.id} />
                </TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                <TabsTrigger value="time">Time tracking</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <Description task={task} />
                <Separator />
                <TaskComments taskId={task.id} />
              </TabsContent>

              <TabsContent value="checklist" className="mt-4">
                <TaskChecklist task={task} />
              </TabsContent>

              <TabsContent value="subtasks" className="mt-4">
                <SubtaskTree rootId={task.id} />
              </TabsContent>

              <TabsContent value="comments" className="mt-4">
                <ThreadedComments taskId={task.id} />
              </TabsContent>

              <TabsContent value="files" className="mt-4">
                <TaskFilesPanel taskId={task.id} />
              </TabsContent>

              <TabsContent value="activity" className="mt-4 space-y-6">
                <TaskActivityTimeline taskId={task.id} />
                <CommunicationActivity taskId={task.id} />
              </TabsContent>

              <TabsContent value="dependencies" className="mt-4">
                <Dependencies task={task} />
              </TabsContent>

              <TabsContent value="time" className="mt-4">
                <TaskTimeTab taskId={task.id} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <SidePanel task={task} />
      </div>
    </div>
  );
}

function Description({
  task,
}: {
  task: ReturnType<typeof useTasksStateOptional> extends infer T ? NonNullable<T> : never;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task!.description);

  if (!task) return null;

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              updateTask(task.id, { description: draft });
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(task.description);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Description</Label>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        {task.description ? (
          <pre className="whitespace-pre-wrap font-sans">{task.description}</pre>
        ) : (
          <p className="text-muted-foreground">No description yet.</p>
        )}
      </div>
    </div>
  );
}

function SidePanel({ task }: { task: NonNullable<ReturnType<typeof useTasksStateOptional>> }) {
  const people = useProjectsState((s) => s.people);
  const projects = useProjectsState((s) => s.projects);
  return (
    <Card className="space-y-4 p-4">
      <SidebarField label="Status">
        <Select
          value={task.status}
          onValueChange={(v) => updateTask(task.id, { status: v as TaskStatus })}
        >
          <SelectTrigger className="h-9">
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
      </SidebarField>
      <SidebarField label="Priority">
        <Select
          value={task.priority}
          onValueChange={(v) => updateTask(task.id, { priority: v as TaskPriority })}
        >
          <SelectTrigger className="h-9">
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
      </SidebarField>
      <SidebarField label="Assignee">
        <Select
          value={task.assigneeId ?? "none"}
          onValueChange={(v) => updateTask(task.id, { assigneeId: v === "none" ? null : v })}
        >
          <SelectTrigger className="h-9">
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
      </SidebarField>
      <SidebarField label="Reporter">
        <EmployeeChip id={task.reporterId} />
      </SidebarField>
      <SidebarField label="Project">
        <Select value={task.projectId} onValueChange={(v) => updateTask(task.id, { projectId: v })}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.icon} {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SidebarField>
      <div className="grid grid-cols-2 gap-3">
        <SidebarField label="Start">
          <Input
            type="date"
            value={task.startDate ? task.startDate.slice(0, 10) : ""}
            onChange={(e) =>
              updateTask(task.id, {
                startDate: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </SidebarField>
        <SidebarField label="Due">
          <Input
            type="date"
            value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
            onChange={(e) =>
              updateTask(task.id, {
                dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </SidebarField>
        <SidebarField label="Estimate (h)">
          <Input
            type="number"
            min={0}
            value={task.estimatedHours ?? ""}
            onChange={(e) =>
              updateTask(task.id, {
                estimatedHours: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </SidebarField>
        <SidebarField label="Story points">
          <Input
            type="number"
            min={0}
            value={task.storyPoints ?? ""}
            onChange={(e) =>
              updateTask(task.id, {
                storyPoints: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </SidebarField>
      </div>
      <SidebarField label="Labels">
        <div className="flex flex-wrap gap-1.5">
          {TASK_LABELS.map((l) => {
            const active = task.labels.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() =>
                  updateTask(task.id, {
                    labels: active
                      ? task.labels.filter((x) => x !== l)
                      : [...task.labels, l as TaskLabel],
                  })
                }
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px]",
                  active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                {l}
              </button>
            );
          })}
        </div>
      </SidebarField>
      <SidebarField label="Watchers">
        <div className="space-y-1.5">
          {task.watcherIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">No watchers.</p>
          ) : (
            task.watcherIds.map((id) => (
              <div key={id} className="flex items-center justify-between">
                <EmployeeChip id={id} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleWatcher(task.id, id)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
          <Select onValueChange={(v) => toggleWatcher(task.id, v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Add watcher…" />
            </SelectTrigger>
            <SelectContent>
              {people
                .filter((p) => !task.watcherIds.includes(p.id))
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </SidebarField>
      <Separator />
      <p className="text-[11px] text-muted-foreground">
        Created {formatDate(task.createdAt)} · Updated {formatDate(task.updatedAt)}
      </p>
    </Card>
  );
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Dependencies({ task }: { task: NonNullable<ReturnType<typeof useTasksStateOptional>> }) {
  const allTasks = useTasksState((s) => s.tasks);
  const related = useMemo(
    () =>
      task.relations
        .map((r) => ({ relation: r, other: allTasks.find((t) => t.id === r.taskId) }))
        .filter((r) => r.other),
    [allTasks, task.relations],
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cross-task links
        </p>
        {related.length === 0 ? (
          <p className="text-sm text-muted-foreground">No related tasks linked.</p>
        ) : (
          <ul className="space-y-1.5">
            {related.map(({ relation, other }) => (
              <li key={relation.id} className="flex items-center gap-2 rounded border bg-card p-2">
                <span className="rounded bg-muted px-2 py-0.5 text-[11px] uppercase">
                  {relation.kind.replace("_", " ")}
                </span>
                <Link
                  to="/app/tasks/$id"
                  params={{ id: other!.id }}
                  className="flex-1 truncate text-sm hover:underline"
                >
                  <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                    {other!.ref}
                  </span>
                  {other!.title}
                </Link>
                <TaskStatusBadge status={other!.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Related cross-team dependencies
        </p>
        {task.relatedDependencyIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None linked. Use the Dependencies module to track inter-team blocks.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {task.relatedDependencyIds.map((id) => (
              <li key={id} className="rounded border bg-card p-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function useTasksStateOptional(id: string | null | undefined) {
  return useTasksState((s) => (id ? (s.tasks.find((t) => t.id === id) ?? null) : null));
}

function CommentsTabLabel({ taskId }: { taskId: string }) {
  const count = useCommState(
    (s) => s.comments.filter((c) => c.taskId === taskId && !c.deletedAt).length,
  );
  return <span>Comments{count ? ` · ${count}` : ""}</span>;
}

function FilesTabLabel({ taskId }: { taskId: string }) {
  const count = useCommState((s) => s.files.filter((f) => f.taskId === taskId).length);
  return <span>Files{count ? ` · ${count}` : ""}</span>;
}

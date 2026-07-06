import type { TaskComment, TaskStatus } from "@/features/tasks/types";
import type { ListParams } from "@/services/core";
import {
  TasksService,
  tasksService,
  type TaskRow,
  type TaskRowInsert,
  type TaskRowUpdate,
} from "@/services/tasks";

/**
 * TaskRepository — domain-facing operations for tasks and subtasks against the
 * real `tasks` table. Delegates persistence to {@link TasksService}; subtasks
 * are tasks with a non-null `parent_task_id`.
 *
 * Returns raw {@link TaskRow}s (snake_case). Consumers that need the rich domain
 * `Task` (labels, checklist, dates, …) map + overlay in `features/tasks/store.ts`.
 */
export class TaskRepository {
  constructor(private readonly service: TasksService = tasksService) {}

  // ── Reads ────────────────────────────────────────────────────────────────
  list(params: ListParams<TaskRow> = {}): Promise<TaskRow[]> {
    return this.service.list(params);
  }

  getById(id: string): Promise<TaskRow | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<TaskRow> {
    return this.service.getByIdOrThrow(id);
  }

  listByProject(projectId: string, params: ListParams<TaskRow> = {}): Promise<TaskRow[]> {
    return this.service.listByProject(projectId, params);
  }

  listByAssignee(assigneeId: string, params: ListParams<TaskRow> = {}): Promise<TaskRow[]> {
    return this.service.listByAssignee(assigneeId, params);
  }

  listSubtasks(parentTaskId: string): Promise<TaskRow[]> {
    return this.service.listSubtasks(parentTaskId);
  }

  // ── Writes ───────────────────────────────────────────────────────────────
  create(input: TaskRowInsert): Promise<TaskRow> {
    return this.service.create(input);
  }

  update(id: string, patch: TaskRowUpdate): Promise<TaskRow> {
    return this.service.update(id, patch);
  }

  setStatus(id: string, status: TaskStatus): Promise<TaskRow> {
    return this.service.setStatus(id, status);
  }

  assign(id: string, assigneeId: string | null): Promise<TaskRow> {
    return this.service.assign(id, assigneeId);
  }

  /** Hard-delete a task row (subtasks cascade via the FK). */
  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }

  // ── Comments (unbacked until a task_comments table lands) ──────────────────
  listComments(taskId: string): Promise<TaskComment[]> {
    return this.service.listComments(taskId);
  }

  addComment(taskId: string, authorId: string, body: string): Promise<TaskComment> {
    return this.service.addComment(taskId, authorId, body);
  }
}

/** Shared singleton — import this, not the class. */
export const taskRepository = new TaskRepository();

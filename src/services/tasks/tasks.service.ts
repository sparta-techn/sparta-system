import type { Task, TaskComment, TaskStatus } from "@/features/tasks/types";
import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";

export type TaskInsert = Omit<
  Task,
  "id" | "ref" | "createdAt" | "updatedAt" | "completedAt" | "archivedAt" | "deletedAt"
>;
export type TaskUpdate = Partial<TaskInsert> & {
  completedAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
};

/**
 * TasksService — CRUD for tasks/subtasks plus task-scoped reads (comments,
 * children). Maps onto the future `tasks` and `task_comments` tables. Subtasks
 * are ordinary task rows with a non-null `parentTaskId`.
 */
export class TasksService extends BaseService<Task, TaskInsert, TaskUpdate> {
  protected readonly table = "tasks";
  protected readonly entity = "Task";
  protected readonly defaultOrderBy = "updatedAt";

  /** Tasks within a project. */
  listByProject(projectId: string, params: ListParams<Task> = {}): Promise<Task[]> {
    return this.list({ ...params, filters: { ...params.filters, projectId } });
  }

  /** Tasks assigned to a user. */
  listByAssignee(assigneeId: string, params: ListParams<Task> = {}): Promise<Task[]> {
    return this.list({ ...params, filters: { ...params.filters, assigneeId } });
  }

  /** Direct subtasks of a parent task. */
  listSubtasks(parentTaskId: string): Promise<Task[]> {
    return this.list({ filters: { parentTaskId } });
  }

  /** Move a task to a new status, stamping `completedAt` when it reaches done. */
  setStatus(id: string, status: TaskStatus): Promise<Task> {
    const completedAt = status === "done" ? new Date().toISOString() : null;
    return this.update(id, { status, completedAt } as TaskUpdate);
  }

  /** Reassign a task (or unassign with `null`). */
  assign(id: string, assigneeId: string | null): Promise<Task> {
    return this.update(id, { assigneeId } as TaskUpdate);
  }

  /** Soft-delete a task (UI moves it to trash). */
  softDelete(id: string): Promise<Task> {
    return this.update(id, { deletedAt: new Date().toISOString() } as TaskUpdate);
  }

  /** Comments on a task, oldest first. */
  async listComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await this.client
      .from("task_comments")
      .select("*")
      .eq("taskId", taskId)
      .order("createdAt", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as TaskComment[];
  }

  /** Add a comment to a task. */
  async addComment(taskId: string, authorId: string, body: string): Promise<TaskComment> {
    const { data, error } = await this.client
      .from("task_comments")
      .insert({ taskId, authorId, body } as never)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as TaskComment;
  }
}

/** Shared singleton — import this, not the class. */
export const tasksService = new TasksService();

import type { TaskComment, TaskPriority, TaskStatus } from "@/features/tasks/types";
import { BaseService } from "../core/base-service";
import type { Identifiable, ListParams } from "../core/types";

/**
 * Database row for `public.tasks` — snake_case, minimal columns only.
 *
 * This is the durable, relational slice of a task. The rich domain `Task`
 * (labels, checklist, watchers, relations, dates, story points, ref, …) is
 * assembled in `features/tasks/store.ts`, which overlays the unbacked fields
 * from localStorage on top of this row. Keep this shape 1:1 with the migration
 * `20260705120000_tasks_table.sql`.
 */
export interface TaskRow extends Identifiable {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  parent_task_id: string | null;
  sprint_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Insert payload — server defaults fill id / created_by / timestamps. */
export interface TaskRowInsert {
  id?: string;
  project_id: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  parent_task_id?: string | null;
  sprint_id?: string | null;
  created_by?: string | null;
}

/** Patch payload — any backed column except the immutable id. */
export type TaskRowUpdate = Partial<Omit<TaskRowInsert, "id">>;

/**
 * TasksService — CRUD for the `tasks` table plus a few project/assignee/subtask
 * reads. Subtasks are ordinary rows with a non-null `parent_task_id`.
 *
 * Speaks the DB row shape (snake_case). The camelCase ⇄ snake_case mapping and
 * all overlay/enrichment of non-persisted fields happen in the tasks store,
 * exactly as the project-execution services delegate mapping to the projects
 * store.
 */
export class TasksService extends BaseService<TaskRow, TaskRowInsert, TaskRowUpdate> {
  protected readonly table = "tasks";
  protected readonly entity = "Task";
  protected readonly defaultOrderBy = "updated_at";

  /** Tasks within a project. */
  listByProject(projectId: string, params: ListParams<TaskRow> = {}): Promise<TaskRow[]> {
    return this.list({ ...params, filters: { ...params.filters, project_id: projectId } });
  }

  /** Tasks assigned to a user. */
  listByAssignee(assigneeId: string, params: ListParams<TaskRow> = {}): Promise<TaskRow[]> {
    return this.list({ ...params, filters: { ...params.filters, assignee_id: assigneeId } });
  }

  /** Direct subtasks of a parent task. */
  listSubtasks(parentTaskId: string): Promise<TaskRow[]> {
    return this.list({ filters: { parent_task_id: parentTaskId } });
  }

  /** Move a task to a new status. */
  setStatus(id: string, status: TaskStatus): Promise<TaskRow> {
    return this.update(id, { status });
  }

  /** Reassign a task (or unassign with `null`). */
  assign(id: string, assigneeId: string | null): Promise<TaskRow> {
    return this.update(id, { assignee_id: assigneeId });
  }

  // ── Comments ───────────────────────────────────────────────────────────────
  // NOTE: comments are not yet backed by a `task_comments` table (out of scope
  // for this migration). The tasks store keeps comments in its local overlay;
  // these methods target the future table and are retained for the AI comments
  // source. They will start working once that table lands.

  /** Comments on a task, oldest first. */
  async listComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await this.client
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as TaskComment[];
  }

  /** Add a comment to a task. */
  async addComment(taskId: string, authorId: string, body: string): Promise<TaskComment> {
    const { data, error } = await this.client
      .from("task_comments")
      .insert({ task_id: taskId, author_id: authorId, body } as never)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as TaskComment;
  }
}

/** Shared singleton — import this, not the class. */
export const tasksService = new TasksService();

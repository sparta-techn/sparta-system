import type { Task, TaskComment, TaskStatus } from "@/features/tasks/types";
import type { ListParams } from "@/services/core";
import { TasksService, tasksService, type TaskInsert, type TaskUpdate } from "@/services/tasks";

/**
 * TaskRepository — domain operations for tasks and subtasks. Delegates
 * persistence to {@link TasksService}; subtasks are tasks with a non-null
 * `parentTaskId`.
 */
export class TaskRepository {
  constructor(private readonly service: TasksService = tasksService) {}

  list(params: ListParams<Task> = {}): Promise<Task[]> {
    return this.service.list(params);
  }

  getById(id: string): Promise<Task | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<Task> {
    return this.service.getByIdOrThrow(id);
  }

  listByProject(projectId: string, params: ListParams<Task> = {}): Promise<Task[]> {
    return this.service.listByProject(projectId, params);
  }

  listByAssignee(assigneeId: string, params: ListParams<Task> = {}): Promise<Task[]> {
    return this.service.listByAssignee(assigneeId, params);
  }

  listSubtasks(parentTaskId: string): Promise<Task[]> {
    return this.service.listSubtasks(parentTaskId);
  }

  create(input: TaskInsert): Promise<Task> {
    return this.service.create(input);
  }

  update(id: string, patch: TaskUpdate): Promise<Task> {
    return this.service.update(id, patch);
  }

  setStatus(id: string, status: TaskStatus): Promise<Task> {
    return this.service.setStatus(id, status);
  }

  assign(id: string, assigneeId: string | null): Promise<Task> {
    return this.service.assign(id, assigneeId);
  }

  /** Soft-delete (move to trash). */
  softDelete(id: string): Promise<Task> {
    return this.service.softDelete(id);
  }

  /** Hard-delete. */
  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }

  listComments(taskId: string): Promise<TaskComment[]> {
    return this.service.listComments(taskId);
  }

  addComment(taskId: string, authorId: string, body: string): Promise<TaskComment> {
    return this.service.addComment(taskId, authorId, body);
  }
}

/** Shared singleton — import this, not the class. */
export const taskRepository = new TaskRepository();

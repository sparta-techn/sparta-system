import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the repository the store writes through to.
const create = vi.fn().mockResolvedValue({});
const update = vi.fn().mockResolvedValue({});
vi.mock("@/repositories", () => ({
  taskRepository: {
    list: vi.fn().mockResolvedValue([]),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
  },
}));

import { createTask, updateTask, getTask, listTasks } from "./store";

beforeEach(() => {
  create.mockClear();
  update.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("tasks store write-through", () => {
  it("createTask builds a full Task and inserts only snake_case backed columns", () => {
    const t = createTask(
      { title: "Wire up billing", projectId: "proj-1", reporterId: "user-1", priority: "high" },
      "ETB",
    );

    // Domain shape preserved for the UI.
    expect(t.ref).toMatch(/^ETB-\d+$/);
    expect(t.status).toBe("todo");
    expect(t.labels).toEqual([]);
    expect(getTask(t.id)?.title).toBe("Wire up billing");

    // Persisted payload is the minimal snake_case row (no ref/labels/reporter).
    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: t.id,
      project_id: "proj-1",
      title: "Wire up billing",
      status: "todo",
      priority: "high",
      assignee_id: null,
      parent_task_id: null,
    });
    expect(payload).not.toHaveProperty("ref");
    expect(payload).not.toHaveProperty("labels");
    expect(payload).not.toHaveProperty("created_by");
  });

  it("updateTask write-throughs a backed column change (status → snake_case)", () => {
    const t = createTask({ title: "T", projectId: "p", reporterId: "u" }, "ETB");
    update.mockClear();

    updateTask(t.id, { status: "in_progress" });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]).toEqual([t.id, { status: "in_progress" }]);
    expect(getTask(t.id)?.status).toBe("in_progress");
  });

  it("updateTask does NOT hit the DB for overlay-only fields (labels)", () => {
    const t = createTask({ title: "T", projectId: "p", reporterId: "u" }, "ETB");
    update.mockClear();

    updateTask(t.id, { labels: ["bug", "perf"] });

    expect(update).not.toHaveBeenCalled();
    // …but the optimistic cache still reflects it (overlay).
    expect(getTask(t.id)?.labels).toEqual(["bug", "perf"]);
  });

  it("softDeleteTask stays local (no DB delete column) yet hides the task", () => {
    const t = createTask({ title: "T", projectId: "p", reporterId: "u" }, "ETB");
    update.mockClear();

    updateTask(t.id, { deletedAt: new Date().toISOString() });

    expect(update).not.toHaveBeenCalled();
    expect(listTasks().find((x) => x.id === t.id)).toBeUndefined();
  });
});

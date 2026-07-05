/**
 * UNIT test example — pure functions, `node` environment, no DOM.
 *
 * This is the base of the pyramid: fast, deterministic, one module under test.
 * Co-located as `*.test.ts` so it runs in the `unit` Vitest project. See
 * `docs/TESTING.md`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { checklistProgress, formatRelative, initials, isOverdue } from "./utils";
import type { Task } from "./types";

/** Build just enough of a Task for the function under test. */
function task(overrides: Partial<Task> = {}): Task {
  return {
    checklist: [],
    status: "todo",
    dueDate: null,
    ...overrides,
  } as Task;
}

describe("initials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("grace")).toBe("G");
  });

  it("caps at two letters for long names", () => {
    expect(initials("John Ronald Reuel Tolkien")).toBe("JR");
  });
});

describe("checklistProgress", () => {
  it("returns null when there is no checklist", () => {
    expect(checklistProgress(task({ checklist: [] }))).toBeNull();
  });

  it("computes done/total and a rounded percentage", () => {
    const t = task({
      checklist: [
        { id: "1", text: "a", done: true },
        { id: "2", text: "b", done: true },
        { id: "3", text: "c", done: false },
      ],
    } as Partial<Task>);
    expect(checklistProgress(t)).toEqual({ done: 2, total: 3, pct: 67 });
  });
});

describe("isOverdue", () => {
  afterEach(() => vi.useRealTimers());

  it("is false without a due date", () => {
    expect(isOverdue(task({ dueDate: null }))).toBe(false);
  });

  it("is true when the due date has passed and the task is open", () => {
    vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
    expect(isOverdue(task({ dueDate: "2026-07-01T00:00:00Z", status: "in_progress" }))).toBe(true);
  });

  it("ignores done/cancelled tasks even when past due", () => {
    vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
    expect(isOverdue(task({ dueDate: "2026-07-01T00:00:00Z", status: "done" }))).toBe(false);
    expect(isOverdue(task({ dueDate: "2026-07-01T00:00:00Z", status: "cancelled" }))).toBe(false);
  });
});

describe("formatRelative", () => {
  afterEach(() => vi.useRealTimers());

  it("returns an em dash for nullish input", () => {
    expect(formatRelative(null)).toBe("—");
  });

  it("labels recent past and future as today/tomorrow, else N days", () => {
    vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
    expect(formatRelative("2026-07-02T09:00:00Z")).toBe("today");
    expect(formatRelative("2026-06-29T12:00:00Z")).toBe("3d ago");
  });
});

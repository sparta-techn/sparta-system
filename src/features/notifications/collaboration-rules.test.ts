import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { automationEngine } from "./automation-engine";
import {
  archiveState,
  deleteState,
  isCategoryMuted,
  isNotificationTrigger,
  isUnread,
  markReadState,
  markUnreadState,
  NOTIFICATION_TRIGGERS,
} from "./collaboration-rules";
import { DEFAULT_PREFERENCES, preferences } from "./preferences";
import { defaultRules } from "./rules";
import { notificationStore } from "./store";
import type {
  AppNotification,
  DomainEvent,
  EventName,
  NotificationPreferences,
  NotificationSpec,
  PreferenceCategory,
  RecipientRule,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
  name: EventName,
  opts: { actorId?: string; subjectId?: string; payload?: Record<string, unknown> } = {},
): DomainEvent {
  return {
    id: "evt_test",
    name,
    category: "system",
    actorId: opts.actorId ?? "actor",
    subjectId: opts.subjectId,
    payload: opts.payload ?? {},
    occurredAt: new Date("2026-06-30T09:00:00Z").toISOString(),
  };
}

/** Run all matching rules' `build` for an event (pure — no engine/store). */
function runRules(event: DomainEvent): NotificationSpec[] {
  return defaultRules
    .filter((r) => r.on.includes(event.name))
    .flatMap((r) => (r.when && !r.when(event) ? [] : r.build(event)));
}

function hasUserRecipient(specs: NotificationSpec[], userId: string): boolean {
  return specs.some((s) =>
    s.recipients.some(
      (r: RecipientRule) =>
        (r.kind === "user" || r.kind === "employee") && r.userId === userId,
    ),
  );
}

const baseNotification: AppNotification = {
  id: "n1",
  eventId: "e1",
  eventName: "task.assigned",
  category: "tasks",
  type: "info",
  priority: "high",
  title: "New task",
  body: "A task was assigned to you.",
  recipientId: "u-2",
  channels: ["in_app"],
  createdAt: new Date("2026-06-30T09:00:00Z").toISOString(),
};

// ── 1. Generation triggers ───────────────────────────────────────────────────

describe("notification generation triggers", () => {
  it("covers exactly the nine collaboration events", () => {
    expect([...NOTIFICATION_TRIGGERS]).toEqual([
      "task.assigned",
      "task.status_changed",
      "mention.received",
      "dependency.assigned",
      "comment.added",
      "sprint.started",
      "sprint.completed",
      "attendance.approved",
      "leave.approved",
    ]);
  });

  it("has at least one rule for every trigger", () => {
    for (const trigger of NOTIFICATION_TRIGGERS) {
      expect(defaultRules.some((r) => r.on.includes(trigger))).toBe(true);
    }
  });

  it("task assigned → notifies the assignee (tasks category)", () => {
    const specs = runRules(
      makeEvent("task.assigned", {
        actorId: "u-1",
        subjectId: "T-1",
        payload: { assigneeId: "u-2", title: "Fix login" },
      }),
    );
    expect(specs).toHaveLength(1);
    expect(specs[0].category).toBe("tasks");
    expect(specs[0].type).toBe("info");
    expect(hasUserRecipient(specs, "u-2")).toBe(true);
  });

  it("task assigned to self → no notification", () => {
    const specs = runRules(
      makeEvent("task.assigned", {
        actorId: "u-1",
        subjectId: "T-1",
        payload: { assigneeId: "u-1", title: "Self task" },
      }),
    );
    expect(specs).toHaveLength(0);
  });

  it("task status changed → notifies assignee + reporter, excluding the actor", () => {
    const specs = runRules(
      makeEvent("task.status_changed", {
        actorId: "u-2",
        subjectId: "T-1",
        payload: { assigneeId: "u-2", reporterId: "u-3", status: "In Review", title: "X" },
      }),
    );
    // Actor (u-2) is excluded; only the reporter remains.
    expect(specs).toHaveLength(1);
    expect(hasUserRecipient(specs, "u-3")).toBe(true);
    expect(hasUserRecipient(specs, "u-2")).toBe(false);
    expect(specs[0].category).toBe("tasks");
  });

  it("mention received → notifies each mentioned user (mentions category)", () => {
    const specs = runRules(
      makeEvent("mention.received", {
        actorId: "u-1",
        subjectId: "T-1",
        payload: { userIds: ["u-2", "u-3"], snippet: "hey @u-2 @u-3", href: "/app/tasks/T-1" },
      }),
    );
    expect(specs).toHaveLength(2);
    expect(specs.every((s) => s.category === "mentions")).toBe(true);
    expect(hasUserRecipient(specs, "u-2")).toBe(true);
    expect(hasUserRecipient(specs, "u-3")).toBe(true);
  });

  it("dependency assigned → notifies the owner (dependencies category)", () => {
    const specs = runRules(
      makeEvent("dependency.assigned", {
        actorId: "u-1",
        subjectId: "DEP-1",
        payload: { ownerId: "u-2", title: "Provide API" },
      }),
    );
    expect(specs).toHaveLength(1);
    expect(specs[0].category).toBe("dependencies");
    expect(hasUserRecipient(specs, "u-2")).toBe(true);
  });

  it("comment added → notifies participants, excluding the actor (tasks category)", () => {
    const specs = runRules(
      makeEvent("comment.added", {
        actorId: "u-1",
        subjectId: "T-1",
        payload: { participantIds: ["u-1", "u-2"], snippet: "looks good", href: "/app/tasks/T-1" },
      }),
    );
    expect(specs).toHaveLength(1);
    expect(hasUserRecipient(specs, "u-2")).toBe(true);
    expect(hasUserRecipient(specs, "u-1")).toBe(false);
    expect(specs[0].category).toBe("tasks");
  });

  it("sprint started → notifies members (info)", () => {
    const specs = runRules(
      makeEvent("sprint.started", {
        actorId: "u-1",
        subjectId: "S-5",
        payload: { memberIds: ["u-2", "u-3"], name: "Sprint 5" },
      }),
    );
    expect(specs).toHaveLength(2);
    expect(specs.every((s) => s.category === "tasks" && s.type === "info")).toBe(true);
  });

  it("sprint completed → notifies members (success)", () => {
    const specs = runRules(
      makeEvent("sprint.completed", {
        actorId: "u-1",
        subjectId: "S-5",
        payload: { memberIds: ["u-2"], name: "Sprint 5" },
      }),
    );
    expect(specs).toHaveLength(1);
    expect(specs[0].type).toBe("success");
    expect(specs[0].category).toBe("tasks");
  });

  it("attendance approved → notifies the employee (approvals category)", () => {
    const specs = runRules(makeEvent("attendance.approved", { actorId: "mgr", subjectId: "u-2" }));
    expect(specs).toHaveLength(1);
    expect(specs[0].category).toBe("approvals");
    expect(specs[0].type).toBe("success");
    expect(hasUserRecipient(specs, "u-2")).toBe(true);
  });

  it("leave approved → notifies the employee (approvals category)", () => {
    const specs = runRules(makeEvent("leave.approved", { actorId: "mgr", subjectId: "u-2" }));
    expect(specs).toHaveLength(1);
    expect(specs[0].category).toBe("approvals");
    expect(hasUserRecipient(specs, "u-2")).toBe(true);
  });

  it("isNotificationTrigger recognises collaboration events only", () => {
    expect(isNotificationTrigger("task.assigned")).toBe(true);
    expect(isNotificationTrigger("attendance.late")).toBe(false);
  });
});

// ── 2. Category muting (through the engine) ──────────────────────────────────

describe("category muting", () => {
  beforeAll(() => automationEngine.start());
  beforeEach(() => {
    notificationStore.clear();
    preferences.reset();
  });
  afterAll(() => preferences.reset());

  const taskEvent = () =>
    makeEvent("task.assigned", {
      actorId: "u-1",
      subjectId: "T-1",
      payload: { assigneeId: "u-2", title: "Fix login" },
    });

  it("delivers when the category is enabled", () => {
    automationEngine.dispatch(taskEvent());
    expect(notificationStore.list().some((n) => n.category === "tasks")).toBe(true);
  });

  it("suppresses delivery when the category is muted", () => {
    preferences.setCategory("tasks", false);
    automationEngine.dispatch(taskEvent());
    expect(notificationStore.list()).toHaveLength(0);
  });

  it("re-delivers after the category is un-muted", () => {
    preferences.setCategory("tasks", false);
    automationEngine.dispatch(taskEvent());
    expect(notificationStore.list()).toHaveLength(0);

    notificationStore.clear();
    preferences.setCategory("tasks", true);
    automationEngine.dispatch(taskEvent());
    expect(notificationStore.list().length).toBeGreaterThan(0);
  });
});

// ── 3. Recipient capabilities (mark read / unread / archive / delete) ────────

describe("recipient capabilities", () => {
  it("marks read and is idempotent", () => {
    const read = markReadState(baseNotification, "2026-06-30T10:00:00Z");
    expect(read.readAt).toBe("2026-06-30T10:00:00Z");
    // Re-reading keeps the original timestamp.
    const again = markReadState(read, "2026-06-30T11:00:00Z");
    expect(again.readAt).toBe("2026-06-30T10:00:00Z");
  });

  it("marks unread by clearing the read timestamp", () => {
    const read = markReadState(baseNotification);
    expect(read.readAt).toBeTruthy();
    expect(markUnreadState(read).readAt).toBeNull();
  });

  it("archives (and marks read so it leaves the unread count)", () => {
    const archived = archiveState(baseNotification, "2026-06-30T10:00:00Z");
    expect(archived.archivedAt).toBe("2026-06-30T10:00:00Z");
    expect(archived.readAt).toBe("2026-06-30T10:00:00Z");
  });

  it("deletes via a tombstone timestamp", () => {
    const deleted = deleteState(baseNotification, "2026-06-30T10:00:00Z");
    expect(deleted.deletedAt).toBe("2026-06-30T10:00:00Z");
  });

  it("isUnread reflects the lifecycle", () => {
    expect(isUnread(baseNotification)).toBe(true);
    expect(isUnread(markReadState(baseNotification))).toBe(false);
    expect(isUnread(archiveState(baseNotification))).toBe(false);
    expect(isUnread(deleteState(baseNotification))).toBe(false);
    // Unread again after mark-unread.
    expect(isUnread(markUnreadState(markReadState(baseNotification)))).toBe(true);
  });
});

// ── 4. Mute predicate ────────────────────────────────────────────────────────

describe("isCategoryMuted", () => {
  const prefs: NotificationPreferences = {
    ...DEFAULT_PREFERENCES,
    categories: { ...DEFAULT_PREFERENCES.categories, tasks: false },
  };

  it("is true for a disabled category", () => {
    expect(isCategoryMuted(prefs, "tasks" as PreferenceCategory)).toBe(true);
  });

  it("is false for an enabled category", () => {
    expect(isCategoryMuted(prefs, "mentions")).toBe(false);
  });
});

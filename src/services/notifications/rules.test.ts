import { describe, expect, it } from "vitest";

import {
  buildNotification,
  CATEGORY_BY_EVENT,
  categoryForEvent,
  generateNotification,
  isCategoryMuted,
  isSelfAction,
  isWithinQuietHours,
  shouldGenerate,
  type CollaborationEvent,
  type CollaborationEventName,
} from "./rules";
import type { NotificationPreferencesRow } from "./types";

/** One representative event of every kind, all from actor "u1" to recipient "u2". */
const EVENTS: Record<CollaborationEventName, CollaborationEvent> = {
  "task.assigned": {
    kind: "task.assigned",
    recipientId: "u2",
    actorId: "u1",
    actorName: "Alice",
    taskId: "t1",
    taskTitle: "Ship the inbox",
    href: "/tasks/t1",
  },
  "task.status_changed": {
    kind: "task.status_changed",
    recipientId: "u2",
    actorId: "u1",
    actorName: "Alice",
    taskId: "t1",
    taskTitle: "Ship the inbox",
    fromStatus: "todo",
    toStatus: "in_progress",
  },
  "mention.received": {
    kind: "mention.received",
    recipientId: "u2",
    actorId: "u1",
    actorName: "Alice",
    sourceType: "comment",
    sourceId: "c9",
    excerpt: "hey @bob take a look",
  },
  "dependency.assigned": {
    kind: "dependency.assigned",
    recipientId: "u2",
    actorId: "u1",
    dependencyId: "d1",
    dependencyTitle: "API contract",
  },
  "comment.added": {
    kind: "comment.added",
    recipientId: "u2",
    actorId: "u1",
    actorName: "Alice",
    commentId: "c1",
    entityType: "task",
    entityId: "t1",
    entityTitle: "Ship the inbox",
  },
  "sprint.started": {
    kind: "sprint.started",
    recipientId: "u2",
    actorId: "u1",
    sprintId: "s1",
    sprintName: "Sprint 42",
  },
  "sprint.completed": {
    kind: "sprint.completed",
    recipientId: "u2",
    actorId: "u1",
    sprintId: "s1",
    sprintName: "Sprint 42",
  },
  "attendance.approved": {
    kind: "attendance.approved",
    recipientId: "u2",
    actorId: "mgr",
    recordId: "a1",
    workDate: "2026-06-30",
  },
  "leave.approved": {
    kind: "leave.approved",
    recipientId: "u2",
    actorId: "mgr",
    leaveId: "l1",
    startDate: "2026-07-10",
    endDate: "2026-07-14",
  },
};

const ALL_KINDS = Object.keys(EVENTS) as CollaborationEventName[];

function prefs(overrides: Partial<NotificationPreferencesRow>): NotificationPreferencesRow {
  return {
    user_id: "u2",
    categories: {},
    channels: {},
    quiet_hours: { enabled: false },
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("event → category mapping", () => {
  it("routes every event to a category and stays in sync with categoryForEvent", () => {
    for (const kind of ALL_KINDS) {
      expect(CATEGORY_BY_EVENT[kind]).toBeDefined();
      expect(categoryForEvent(kind)).toBe(CATEGORY_BY_EVENT[kind]);
    }
  });

  it("groups task/comment under system, sprints under announcements, time-off under attendance", () => {
    expect(categoryForEvent("task.assigned")).toBe("system");
    expect(categoryForEvent("task.status_changed")).toBe("system");
    expect(categoryForEvent("comment.added")).toBe("system");
    expect(categoryForEvent("mention.received")).toBe("mentions");
    expect(categoryForEvent("dependency.assigned")).toBe("dependencies");
    expect(categoryForEvent("sprint.started")).toBe("announcements");
    expect(categoryForEvent("sprint.completed")).toBe("announcements");
    expect(categoryForEvent("attendance.approved")).toBe("attendance");
    expect(categoryForEvent("leave.approved")).toBe("attendance");
  });
});

describe("buildNotification", () => {
  it("builds a well-formed row for every event kind", () => {
    for (const kind of ALL_KINDS) {
      const n = buildNotification(EVENTS[kind]);
      expect(n.recipient_id).toBe("u2");
      expect(n.event_name).toBe(kind);
      expect(n.category).toBe(categoryForEvent(kind));
      expect(n.title).toBeTruthy();
      expect(typeof n.title).toBe("string");
      expect(n.payload).toBeTypeOf("object");
    }
  });

  it("names the actor in the copy and carries the entity + href", () => {
    const n = buildNotification(EVENTS["task.assigned"]);
    expect(n.title).toBe("Alice assigned you a task");
    expect(n.body).toBe("Ship the inbox");
    expect(n.entity_type).toBe("task");
    expect(n.entity_id).toBe("t1");
    expect(n.href).toBe("/tasks/t1");
    expect(n.actor_id).toBe("u1");
  });

  it('falls back to "Someone" when the actor name is missing', () => {
    expect(buildNotification(EVENTS["dependency.assigned"]).title).toBe(
      "Someone assigned you a dependency",
    );
  });

  it("records the status transition in title, body and payload", () => {
    const n = buildNotification(EVENTS["task.status_changed"]);
    expect(n.title).toBe("Ship the inbox moved to in_progress");
    expect(n.body).toContain("from todo to in_progress");
    expect(n.payload).toMatchObject({ from_status: "todo", to_status: "in_progress" });
  });

  it("assigns high priority to mentions and dependencies, normal to the rest", () => {
    expect(buildNotification(EVENTS["mention.received"]).priority).toBe("high");
    expect(buildNotification(EVENTS["dependency.assigned"]).priority).toBe("high");
    expect(buildNotification(EVENTS["task.assigned"]).priority).toBe("normal");
    expect(buildNotification(EVENTS["sprint.started"]).priority).toBe("normal");
  });

  it("uses success/warning types where appropriate", () => {
    expect(buildNotification(EVENTS["sprint.completed"]).type).toBe("success");
    expect(buildNotification(EVENTS["attendance.approved"]).type).toBe("success");
    expect(buildNotification(EVENTS["leave.approved"]).type).toBe("success");
    expect(buildNotification(EVENTS["dependency.assigned"]).type).toBe("warning");
    expect(buildNotification(EVENTS["task.assigned"]).type).toBe("info");
  });

  it("renders a leave range, or a single start date when there is no end", () => {
    expect(buildNotification(EVENTS["leave.approved"]).body).toBe("2026-07-10 → 2026-07-14");
    const openEnded = buildNotification({
      ...EVENTS["leave.approved"],
      kind: "leave.approved",
      endDate: undefined,
    } as CollaborationEvent);
    expect(openEnded.body).toBe("Starting 2026-07-10");
  });
});

describe("self-suppression", () => {
  it("treats an event as self-action only when actor === recipient", () => {
    expect(isSelfAction(EVENTS["task.assigned"])).toBe(false);
    expect(isSelfAction({ ...EVENTS["task.assigned"], actorId: "u2" })).toBe(true);
  });

  it("is never a self-action for system events with no actor", () => {
    expect(isSelfAction({ ...EVENTS["sprint.started"], actorId: null })).toBe(false);
    expect(isSelfAction({ ...EVENTS["sprint.started"], actorId: undefined })).toBe(false);
  });

  it("does not generate a notification for your own action", () => {
    expect(generateNotification({ ...EVENTS["comment.added"], actorId: "u2" })).toBeNull();
  });
});

describe("muted categories", () => {
  it("is muted only on an explicit false; missing or true means enabled", () => {
    expect(isCategoryMuted(prefs({ categories: { system: false } }), "system")).toBe(true);
    expect(isCategoryMuted(prefs({ categories: { system: true } }), "system")).toBe(false);
    expect(isCategoryMuted(prefs({ categories: {} }), "system")).toBe(false);
    expect(isCategoryMuted(null, "system")).toBe(false);
    expect(isCategoryMuted(undefined, "system")).toBe(false);
  });

  it("suppresses every event mapped to a muted category", () => {
    const muted = prefs({ categories: { attendance: false } });
    // both attendance.approved and leave.approved route to "attendance"
    expect(generateNotification(EVENTS["attendance.approved"], muted)).toBeNull();
    expect(generateNotification(EVENTS["leave.approved"], muted)).toBeNull();
    // an unrelated category is unaffected
    expect(generateNotification(EVENTS["mention.received"], muted)).not.toBeNull();
  });

  it("generates normally when nothing is muted", () => {
    for (const kind of ALL_KINDS) {
      expect(shouldGenerate(EVENTS[kind], prefs({}))).toBe(true);
      expect(generateNotification(EVENTS[kind], prefs({}))).not.toBeNull();
    }
  });
});

describe("quiet hours (push-channel gate, does not block in-app)", () => {
  const at = (hhmm: string) => new Date(`2026-06-30T${hhmm}:00`);

  it("is inactive unless enabled with a start and end", () => {
    expect(isWithinQuietHours(prefs({ quiet_hours: { enabled: false } }), at("23:00"))).toBe(false);
    expect(
      isWithinQuietHours(prefs({ quiet_hours: { enabled: true, start: "22:00" } }), at("23:00")),
    ).toBe(false);
  });

  it("matches a same-day window inclusively at the start, exclusively at the end", () => {
    const p = prefs({ quiet_hours: { enabled: true, start: "09:00", end: "17:00" } });
    expect(isWithinQuietHours(p, at("09:00"))).toBe(true);
    expect(isWithinQuietHours(p, at("12:30"))).toBe(true);
    expect(isWithinQuietHours(p, at("17:00"))).toBe(false);
    expect(isWithinQuietHours(p, at("08:59"))).toBe(false);
  });

  it("wraps past midnight for an overnight window", () => {
    const p = prefs({ quiet_hours: { enabled: true, start: "22:00", end: "07:00" } });
    expect(isWithinQuietHours(p, at("23:30"))).toBe(true);
    expect(isWithinQuietHours(p, at("06:59"))).toBe(true);
    expect(isWithinQuietHours(p, at("07:00"))).toBe(false);
    expect(isWithinQuietHours(p, at("12:00"))).toBe(false);
  });

  it("does not affect in-app generation", () => {
    // quiet hours gate push only; shouldGenerate ignores them
    const p = prefs({ quiet_hours: { enabled: true, start: "00:00", end: "23:59" } });
    expect(shouldGenerate(EVENTS["task.assigned"], p)).toBe(true);
  });
});

/**
 * Realistic seed notifications + a mock event generator for dev/demo.
 * Seeds run only once per browser (idempotent flag in localStorage).
 */

import { eventBus } from "./event-bus";
import { notificationStore } from "./store";
import type { AppNotification } from "./types";

const CURRENT_USER_ID = "u-me";
const SEED_FLAG = "sf:notifications:seeded:v1";

function iso(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function nid(prefix = "seed") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const SEED: AppNotification[] = [
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "dependency.mentioned",
    category: "mentions",
    type: "info",
    priority: "high",
    title: "Emir Y. mentioned you",
    body: "@aylin can you confirm whether the auth endpoint needs the org id?",
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/dependencies/DEP-1042",
    createdAt: iso(8),
  },
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "dependency.overdue",
    category: "dependencies",
    type: "critical",
    priority: "critical",
    title: "Dependency overdue",
    body: "Helios API · pagination contract is 2h past due.",
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/dependencies/DEP-1038",
    createdAt: iso(35),
  },
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "midday.missing",
    category: "reports",
    type: "reminder",
    priority: "normal",
    title: "Midday status pending",
    body: "Quick progress update keeps blockers visible.",
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/midday",
    createdAt: iso(120),
    readAt: iso(60),
  },
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "dependency.resolved",
    category: "dependencies",
    type: "success",
    priority: "normal",
    title: "Dependency resolved",
    body: 'Sena B. resolved "Empty state copy for onboarding".',
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/dependencies/DEP-1031",
    createdAt: iso(60 * 5),
    readAt: iso(60 * 4),
  },
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "announcement.published",
    category: "announcements",
    type: "info",
    priority: "normal",
    title: "All-hands moved to Thursday",
    body: "This week's all-hands will run at 16:00 UTC on Thursday.",
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/announcements",
    createdAt: iso(60 * 7),
    readAt: iso(60 * 6),
  },
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "attendance.checked_in",
    category: "attendance",
    type: "success",
    priority: "low",
    title: "You're checked in",
    body: "Have a productive day. Don't forget the morning check-in.",
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/check-in",
    createdAt: iso(60 * 26),
    readAt: iso(60 * 25),
  },
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "dependency.assigned",
    category: "dependencies",
    type: "info",
    priority: "high",
    title: "New dependency assigned to you",
    body: "Backend infra · Add S3 signed-URL helper",
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/dependencies/DEP-1027",
    createdAt: iso(60 * 30),
    readAt: iso(60 * 28),
  },
  {
    id: nid(),
    eventId: nid("evt"),
    eventName: "eod.missing",
    category: "reports",
    type: "reminder",
    priority: "high",
    title: "Wrap up your day",
    body: "Submit your end-of-day report before you check out.",
    recipientId: CURRENT_USER_ID,
    channels: ["in_app"],
    href: "/app/eod",
    createdAt: iso(60 * 28),
    readAt: iso(60 * 27),
    archivedAt: iso(60 * 27),
  },
];

export function seedNotificationsOnce() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;
  notificationStore.addMany(SEED);
  window.localStorage.setItem(SEED_FLAG, "1");
}

/** Demo helper — fires a fresh event for the current user. */
export function fireDemoEvent(kind: "mention" | "overdue" | "resolved" | "announce") {
  switch (kind) {
    case "mention":
      eventBus.publish({
        name: "dependency.mentioned",
        actorId: "u-emir",
        subjectId: "DEP-1042",
        payload: {
          userIds: [CURRENT_USER_ID],
          snippet: "@aylin can you take a look when you get a sec?",
        },
      });
      break;
    case "overdue":
      eventBus.publish({
        name: "dependency.overdue",
        actorId: "system",
        subjectId: "DEP-1038",
        payload: {
          title: "Helios API · pagination contract",
          ownerId: CURRENT_USER_ID,
          requesterId: "u-ali",
        },
      });
      break;
    case "resolved":
      eventBus.publish({
        name: "dependency.resolved",
        actorId: "u-sena",
        subjectId: "DEP-1031",
        payload: {
          title: "Empty state copy for onboarding",
          requesterId: CURRENT_USER_ID,
        },
      });
      break;
    case "announce":
      eventBus.publish({
        name: "announcement.published",
        actorId: "u-deniz",
        subjectId: "ann-101",
        payload: {
          title: "Friday demo: new dependency board",
          summary: "Live walkthrough at 15:00 UTC. Recording will follow.",
        },
      });
      break;
  }
}

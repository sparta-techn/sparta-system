/**
 * Default automation rules. Each rule listens for one or more event names
 * and produces NotificationSpec[]. Adding a new rule = append to this list.
 */

import type { AutomationRule } from "./types";

export const defaultRules: AutomationRule[] = [
  // ---------- Attendance ----------
  {
    id: "att.late.notify-self",
    description: "Late check-in → nudge the employee",
    on: ["attendance.late"],
    build: (e) => [
      {
        recipients: [{ kind: "employee", userId: e.subjectId! }],
        category: "attendance",
        type: "warning",
        priority: "high",
        title: "You're running late",
        body: "Standard start was 09:30. Check in when you're ready.",
        href: "/app/attendance",
        actions: [{ label: "Check in", href: "/app/check-in", kind: "primary" }],
      },
    ],
  },
  {
    id: "att.absent.notify-manager",
    description: "Still absent at 10:00 → notify manager",
    on: ["attendance.absent"],
    build: (e) => [
      {
        recipients: [{ kind: "manager", ofUserId: e.subjectId! }],
        category: "attendance",
        type: "critical",
        priority: "critical",
        title: `${(e.payload.name as string) ?? "An employee"} hasn't checked in`,
        body: "No attendance signal by 10:00. Reach out to confirm status.",
        href: "/app/attendance/team",
      },
    ],
  },
  {
    id: "att.checked_in.welcome",
    description: "Welcome ping on first check-in of the day",
    on: ["attendance.checked_in"],
    build: (e) => [
      {
        recipients: [{ kind: "employee", userId: e.subjectId! }],
        category: "attendance",
        type: "success",
        priority: "low",
        title: "You're checked in",
        body: "Have a productive day. Don't forget the morning check-in.",
        href: "/app/check-in",
      },
    ],
  },

  // ---------- Check-in / Midday / EOD ----------
  {
    id: "checkin.missing.reminder",
    description: "Morning check-in still missing",
    on: ["checkin.missing"],
    build: (e) => [
      {
        recipients: [{ kind: "employee", userId: e.subjectId! }],
        category: "reports",
        type: "reminder",
        priority: "normal",
        title: "Morning check-in pending",
        body: "Two minutes — share today's main goal so the team can plan.",
        href: "/app/check-in",
      },
    ],
  },
  {
    id: "midday.missing.reminder",
    description: "Midday status missing by 14:00",
    on: ["midday.missing"],
    build: (e) => [
      {
        recipients: [{ kind: "employee", userId: e.subjectId! }],
        category: "reports",
        type: "reminder",
        priority: "normal",
        title: "Midday status pending",
        body: "Quick progress update keeps blockers visible.",
        href: "/app/midday",
      },
    ],
  },
  {
    id: "eod.missing.reminder",
    description: "End-of-day report missing by 17:30",
    on: ["eod.missing"],
    build: (e) => [
      {
        recipients: [{ kind: "employee", userId: e.subjectId! }],
        category: "reports",
        type: "reminder",
        priority: "high",
        title: "Wrap up your day",
        body: "Submit your end-of-day report before you check out.",
        href: "/app/eod",
        actions: [{ label: "Open report", href: "/app/eod", kind: "primary" }],
      },
    ],
  },

  // ---------- Dependency ----------
  {
    id: "dep.assigned.owner",
    description: "Dependency assigned → notify owner",
    on: ["dependency.assigned"],
    build: (e) => {
      const ownerId = e.payload.ownerId as string | undefined;
      if (!ownerId) return [];
      return [
        {
          recipients: [{ kind: "user", userId: ownerId }],
          category: "dependencies",
          type: "info",
          priority: "high",
          title: `New dependency assigned to you`,
          body: (e.payload.title as string) ?? "A dependency was routed to you.",
          href: `/app/dependencies/${e.subjectId}`,
          actions: [{ label: "Open", href: `/app/dependencies/${e.subjectId}`, kind: "primary" }],
        },
      ];
    },
  },
  {
    id: "dep.mentioned",
    description: "User mentioned in a comment",
    on: ["dependency.mentioned"],
    build: (e) => {
      const userIds = (e.payload.userIds as string[] | undefined) ?? [];
      return userIds.map((userId) => ({
        recipients: [{ kind: "user" as const, userId }],
        category: "mentions" as const,
        type: "info" as const,
        priority: "high" as const,
        title: "You were mentioned",
        body: (e.payload.snippet as string) ?? "Someone tagged you in a thread.",
        href: `/app/dependencies/${e.subjectId}`,
      }));
    },
  },
  {
    id: "dep.overdue.escalate",
    description: "Critical dependency overdue → owner, requester, manager",
    on: ["dependency.overdue"],
    build: (e) => {
      const ownerId = e.payload.ownerId as string | undefined;
      const requesterId = e.payload.requesterId as string | undefined;
      const specs = [];
      if (ownerId) {
        specs.push({
          recipients: [{ kind: "user" as const, userId: ownerId }],
          category: "dependencies" as const,
          type: "critical" as const,
          priority: "critical" as const,
          title: "Dependency overdue",
          body: (e.payload.title as string) ?? "A critical dependency is past due.",
          href: `/app/dependencies/${e.subjectId}`,
        });
        specs.push({
          recipients: [{ kind: "manager" as const, ofUserId: ownerId }],
          category: "dependencies" as const,
          type: "critical" as const,
          priority: "critical" as const,
          title: "Overdue dependency in your team",
          body: (e.payload.title as string) ?? "Critical block needs attention.",
          href: `/app/dependencies/${e.subjectId}`,
        });
      }
      if (requesterId) {
        specs.push({
          recipients: [{ kind: "user" as const, userId: requesterId }],
          category: "dependencies" as const,
          type: "warning" as const,
          priority: "high" as const,
          title: "Your dependency is overdue",
          body: (e.payload.title as string) ?? "Still waiting on a resolution.",
          href: `/app/dependencies/${e.subjectId}`,
        });
      }
      return specs;
    },
  },
  {
    id: "dep.resolved.requester",
    description: "Dependency resolved → notify requester",
    on: ["dependency.resolved"],
    build: (e) => {
      const requesterId = e.payload.requesterId as string | undefined;
      if (!requesterId) return [];
      return [
        {
          recipients: [{ kind: "user", userId: requesterId }],
          category: "dependencies",
          type: "success",
          priority: "normal",
          title: "Dependency resolved",
          body: (e.payload.title as string) ?? "Your block has been cleared.",
          href: `/app/dependencies/${e.subjectId}`,
        },
      ];
    },
  },
  {
    id: "dep.comment.owner",
    description: "New comment → notify owner + requester (excluding actor)",
    on: ["dependency.comment_added"],
    build: (e) => {
      const ownerId = e.payload.ownerId as string | undefined;
      const requesterId = e.payload.requesterId as string | undefined;
      const targets = [ownerId, requesterId].filter((id): id is string => !!id && id !== e.actorId);
      return targets.map((userId) => ({
        recipients: [{ kind: "user" as const, userId }],
        category: "dependencies" as const,
        type: "info" as const,
        priority: "normal" as const,
        title: "New comment on dependency",
        body: (e.payload.snippet as string) ?? "Someone replied on a thread you follow.",
        href: `/app/dependencies/${e.subjectId}`,
      }));
    },
  },

  // ---------- Announcements ----------
  {
    id: "announcement.published.everyone",
    description: "Announcement published → notify everyone",
    on: ["announcement.published"],
    build: (e) => [
      {
        recipients: [
          { kind: "role", role: "employee" },
          { kind: "role", role: "manager" },
        ],
        category: "announcements",
        type: "info",
        priority: "normal",
        title: (e.payload.title as string) ?? "New announcement",
        body: (e.payload.summary as string) ?? "Open to read the full announcement.",
        href: "/app/announcements",
      },
    ],
  },

  // ---------- User ----------
  {
    id: "user.invited",
    description: "Invitation sent",
    on: ["user.invited"],
    build: (e) => [
      {
        recipients: [{ kind: "user", userId: e.subjectId! }],
        category: "system",
        type: "info",
        priority: "high",
        title: "Welcome to SpartaFlow Hub",
        body: "Accept your invitation to finish setting up your account.",
        href: "/auth/accept-invitation",
      },
    ],
  },
  {
    id: "user.role_changed",
    description: "Role changed",
    on: ["user.role_changed"],
    build: (e) => [
      {
        recipients: [{ kind: "user", userId: e.subjectId! }],
        category: "system",
        type: "info",
        priority: "normal",
        title: "Your role was updated",
        body: `You are now a ${(e.payload.role as string) ?? "team member"}.`,
      },
    ],
  },

  // ---------- Tasks ----------
  {
    id: "task.assigned.assignee",
    description: "Task assigned → notify the assignee",
    on: ["task.assigned"],
    build: (e) => {
      const assigneeId = e.payload.assigneeId as string | undefined;
      // Don't notify someone who assigned a task to themselves.
      if (!assigneeId || assigneeId === e.actorId) return [];
      return [
        {
          recipients: [{ kind: "user", userId: assigneeId }],
          category: "tasks",
          type: "info",
          priority: "high",
          title: "New task assigned to you",
          body: (e.payload.title as string) ?? "A task was assigned to you.",
          href: `/app/tasks/${e.subjectId}`,
          actions: [{ label: "Open task", href: `/app/tasks/${e.subjectId}`, kind: "primary" }],
        },
      ];
    },
  },
  {
    id: "task.status_changed.watchers",
    description: "Task status changed → notify assignee + reporter (excluding actor)",
    on: ["task.status_changed"],
    build: (e) => {
      const assigneeId = e.payload.assigneeId as string | undefined;
      const reporterId = e.payload.reporterId as string | undefined;
      const status = (e.payload.status as string) ?? "updated";
      const targets = [assigneeId, reporterId].filter(
        (id): id is string => !!id && id !== e.actorId,
      );
      return targets.map((userId) => ({
        recipients: [{ kind: "user" as const, userId }],
        category: "tasks" as const,
        type: "info" as const,
        priority: "normal" as const,
        title: "Task status changed",
        body: `"${(e.payload.title as string) ?? "A task"}" is now ${status}.`,
        href: `/app/tasks/${e.subjectId}`,
      }));
    },
  },

  // ---------- Mention (generic) ----------
  {
    id: "mention.received",
    description: "User mentioned anywhere (task, comment, project)",
    on: ["mention.received"],
    build: (e) => {
      const userIds = (e.payload.userIds as string[] | undefined) ?? [];
      const href = e.payload.href as string | undefined;
      return userIds
        .filter((userId) => userId !== e.actorId)
        .map((userId) => ({
          recipients: [{ kind: "user" as const, userId }],
          category: "mentions" as const,
          type: "info" as const,
          priority: "high" as const,
          title: "You were mentioned",
          body: (e.payload.snippet as string) ?? "Someone tagged you.",
          href: href ?? undefined,
        }));
    },
  },

  // ---------- Comment (generic) ----------
  {
    id: "comment.added.participants",
    description: "Comment added → notify thread participants (excluding actor)",
    on: ["comment.added"],
    build: (e) => {
      const participantIds = (e.payload.participantIds as string[] | undefined) ?? [];
      const href = e.payload.href as string | undefined;
      return participantIds
        .filter((userId) => userId !== e.actorId)
        .map((userId) => ({
          recipients: [{ kind: "user" as const, userId }],
          category: "tasks" as const,
          type: "info" as const,
          priority: "normal" as const,
          title: "New comment",
          body: (e.payload.snippet as string) ?? "Someone commented on a thread you follow.",
          href: href ?? undefined,
        }));
    },
  },

  // ---------- Sprint ----------
  {
    id: "sprint.started.members",
    description: "Sprint started → notify sprint members",
    on: ["sprint.started"],
    build: (e) => {
      const memberIds = (e.payload.memberIds as string[] | undefined) ?? [];
      const name = (e.payload.name as string) ?? "A new sprint";
      const href = (e.payload.href as string) ?? `/app/sprints/${e.subjectId}`;
      return memberIds.map((userId) => ({
        recipients: [{ kind: "user" as const, userId }],
        category: "tasks" as const,
        type: "info" as const,
        priority: "normal" as const,
        title: "Sprint started",
        body: `${name} is now underway.`,
        href,
      }));
    },
  },
  {
    id: "sprint.completed.members",
    description: "Sprint completed → notify sprint members",
    on: ["sprint.completed"],
    build: (e) => {
      const memberIds = (e.payload.memberIds as string[] | undefined) ?? [];
      const name = (e.payload.name as string) ?? "The sprint";
      const href = (e.payload.href as string) ?? `/app/sprints/${e.subjectId}`;
      return memberIds.map((userId) => ({
        recipients: [{ kind: "user" as const, userId }],
        category: "tasks" as const,
        type: "success" as const,
        priority: "normal" as const,
        title: "Sprint completed",
        body: `${name} has been completed. Nice work.`,
        href,
      }));
    },
  },

  // ---------- Approvals ----------
  {
    id: "attendance.approved.employee",
    description: "Attendance approved → notify the employee",
    on: ["attendance.approved"],
    build: (e) => [
      {
        recipients: [{ kind: "employee", userId: e.subjectId! }],
        category: "approvals",
        type: "success",
        priority: "normal",
        title: "Attendance approved",
        body: (e.payload.note as string) ?? "Your attendance record was approved.",
        href: "/app/attendance",
      },
    ],
  },
  {
    id: "leave.approved.employee",
    description: "Leave approved → notify the employee",
    on: ["leave.approved"],
    build: (e) => [
      {
        recipients: [{ kind: "employee", userId: e.subjectId! }],
        category: "approvals",
        type: "success",
        priority: "normal",
        title: "Leave approved",
        body:
          (e.payload.summary as string) ?? "Your leave request was approved. Enjoy your time off.",
        href: "/app/leave",
      },
    ],
  },
];

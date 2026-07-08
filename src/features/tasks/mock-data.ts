/**
 * Realistic mock data for the Tasks module.
 * Generates tasks across the seeded projects with subtasks, checklists,
 * watchers, comments, activity, and a small saved-filter library.
 *
 * Pure mock — no network. Used as the initial state for the in-memory store.
 */
import { employees } from "@/features/hr/mock-data";
import { seedProjects } from "@/features/projects/mock-data";
import type {
  Epic,
  SavedFilter,
  Task,
  TaskActivity,
  TaskComment,
  TaskLabel,
  TaskMilestone,
  TaskPriority,
  TaskStatus,
} from "./types";

const STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "qa",
  "done",
  "blocked",
];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];
const LABELS: TaskLabel[] = [
  "bug",
  "feature",
  "chore",
  "spike",
  "research",
  "docs",
  "design",
  "tech-debt",
  "security",
  "perf",
];

const TITLE_BANK = [
  "Integrate driver location stream into control room",
  "Add OTP fallback when SMS provider rate-limits",
  "Refactor booking state machine",
  "Migrate analytics events to v2 schema",
  "Fix overflow on dispatch table at 1440px",
  "Onboarding empty state copy review",
  "Spike: evaluate Tigris vs S3 for asset storage",
  "Audit log export — CSV + signed URL",
  "Reduce checkout JS bundle below 180kb",
  "Patch JWT refresh race condition",
  "Wire push notifications for partner orders",
  "Resolve flaky e2e on Safari iOS",
  "Add saved filters to project task list",
  "Document RLS policies for finance schema",
  "Sprint retro action items follow-up",
  "Performance: cold-start of merchant dashboard",
  "Design review: empty wallet screen",
  "Add role-based gate on /admin/users",
  "Stripe webhook idempotency safeguard",
  "Bulk import — handle duplicate emails gracefully",
  "Migrate auth callback to TanStack server fn",
  "QA pass on settings → security tab",
  "Localize date formats for ar-AE locale",
  "Hot-fix: dependency badge counts off by one",
  "Add inline rich-text toolbar to task description",
  "Schema migration: add `archived_at` to comments",
  "Replace placeholder copy on /pricing",
  "Investigate memory spike on import worker",
  "Wire telemetry to Datadog RUM",
  "Add unit tests for has_role() helper",
];

const CHECKLIST_BANK = [
  "Confirm acceptance criteria with PM",
  "Update API contract",
  "Add Storybook entry",
  "Cover with unit tests",
  "Manual QA pass",
  "Update changelog",
  "Notify support team",
  "Ship feature flag",
  "Backfill historical data",
  "Add Sentry breadcrumb",
];

const COMMENT_BANK = [
  "Picked this up — should land before EOW.",
  "Blocked on the API change tracked in DEP-214. Following up.",
  "Confirmed with design, copy updates are in.",
  "Reverted the optimistic update — it caused a flash. Will revisit.",
  "QA — please retest with the new build.",
  "Bumping priority, customer escalation came in.",
  "Pushed a draft PR for early review.",
  "Closing — duplicate of FNX-87.",
];

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rand = seeded(20260629);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)] as T;
const pickMany = <T>(arr: readonly T[], n: number) => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i += 1) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  }
  return out;
};

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(now + n * 86_400_000).toISOString();

// ---------- Epics & milestones ----------

export const seedEpics: Epic[] = seedProjects.flatMap((p, idx) => {
  const owner = employees[(idx * 3) % employees.length]!;
  return [
    {
      id: `${p.id}-epic-core`,
      projectId: p.id,
      name: "Core platform",
      color: p.color,
      ownerId: owner.id,
    },
    {
      id: `${p.id}-epic-growth`,
      projectId: p.id,
      name: "Growth & onboarding",
      color: p.color,
      ownerId: owner.id,
    },
    {
      id: `${p.id}-epic-quality`,
      projectId: p.id,
      name: "Quality & reliability",
      color: p.color,
      ownerId: owner.id,
    },
  ];
});

export const seedMilestones: TaskMilestone[] = seedProjects.flatMap((p, idx) => [
  { id: `${p.id}-m1`, projectId: p.id, name: "MVP cut", dueDate: daysAhead(15 + idx * 3) },
  { id: `${p.id}-m2`, projectId: p.id, name: "Public beta", dueDate: daysAhead(45 + idx * 4) },
  { id: `${p.id}-m3`, projectId: p.id, name: "GA launch", dueDate: daysAhead(90 + idx * 5) },
]);

// ---------- Tasks ----------

function makeChecklist(seedIdx: number): Task["checklist"] {
  const count = Math.floor(rand() * 4) + 1;
  const items = pickMany(CHECKLIST_BANK, count);
  return items.map((text, i) => ({
    id: `cl-${seedIdx}-${i}`,
    text,
    done: rand() > 0.55,
  }));
}

function makeTask(idx: number, parent?: Task): Task {
  const project = seedProjects[idx % seedProjects.length]!;
  const projectEpics = seedEpics.filter((e) => e.projectId === project.id);
  const projectMs = seedMilestones.filter((m) => m.projectId === project.id);
  const status = parent
    ? pick(["todo", "in_progress", "review", "done"] as TaskStatus[])
    : pick(STATUSES);
  const priority = pick(PRIORITIES);
  const assignee = rand() > 0.15 ? employees[Math.floor(rand() * employees.length)]! : null;
  const reporter = employees[(idx + 7) % employees.length]!;
  const watchers = pickMany(employees, Math.floor(rand() * 3)).map((e) => e.id);
  const createdOffset = Math.floor(rand() * 28) + 1;
  const updatedOffset = Math.floor(rand() * createdOffset);
  const dueOffset = Math.floor(rand() * 30) - 6;
  const labels = pickMany(LABELS, Math.floor(rand() * 3));
  const title = parent
    ? `${pick(["Implement", "Polish", "QA", "Spec", "Wire", "Document"])}: ${pick(TITLE_BANK).toLowerCase()}`
    : pick(TITLE_BANK);

  return {
    id: `task-${idx.toString(36)}-${Math.floor(rand() * 9999).toString(36)}`,
    ref: `${project.key}-${100 + idx}`,
    title,
    description:
      "## Context\nDescribe the user-facing problem and the desired outcome.\n\n## Acceptance criteria\n- Behaves as designed across breakpoints.\n- Telemetry events emitted.\n- Docs updated.\n",
    status,
    priority,
    labels,
    projectId: project.id,
    epicId: projectEpics[Math.floor(rand() * projectEpics.length)]?.id ?? null,
    milestoneId: projectMs[Math.floor(rand() * projectMs.length)]?.id ?? null,
    sprintId: null,
    assigneeId: assignee?.id ?? null,
    reporterId: reporter.id,
    watcherIds: watchers,
    startDate: rand() > 0.5 ? daysAgo(Math.floor(rand() * 7)) : null,
    dueDate: rand() > 0.2 ? (dueOffset >= 0 ? daysAhead(dueOffset) : daysAgo(-dueOffset)) : null,
    estimatedHours: rand() > 0.4 ? Math.floor(rand() * 16) + 1 : null,
    storyPoints: rand() > 0.3 ? ([1, 2, 3, 5, 8, 13][Math.floor(rand() * 6)] ?? null) : null,
    checklist: makeChecklist(idx),
    attachments: [],
    relatedDependencyIds: [],
    parentTaskId: parent?.id ?? null,
    relations: [],
    createdAt: daysAgo(createdOffset),
    updatedAt: daysAgo(updatedOffset),
    completedAt: status === "done" ? daysAgo(Math.floor(rand() * 5)) : null,
    archivedAt: null,
    deletedAt: null,
  };
}

const TOP_LEVEL_COUNT = 64;

const topLevel: Task[] = Array.from({ length: TOP_LEVEL_COUNT }, (_, i) => makeTask(i));

const subtasks: Task[] = topLevel.flatMap((parent, i) => {
  if (rand() > 0.55) return [];
  const count = Math.floor(rand() * 3) + 1;
  const children = Array.from({ length: count }, (_, k) =>
    makeTask(TOP_LEVEL_COUNT + i * 5 + k, parent),
  );
  // second-level nesting on ~20% of children
  const grand = children.flatMap((c, gIdx) =>
    rand() > 0.8 ? [makeTask(TOP_LEVEL_COUNT * 4 + i * 9 + gIdx, c)] : [],
  );
  return [...children, ...grand];
});

export const seedTasks: Task[] = [...topLevel, ...subtasks];

// Wire a handful of cross-task relations.
seedTasks.slice(0, 8).forEach((t, i) => {
  const other = seedTasks[(i + 13) % seedTasks.length]!;
  t.relations.push({ id: `rel-${t.id}-${other.id}`, kind: "blocks", taskId: other.id });
});

// ---------- Comments & activity ----------

export const seedComments: TaskComment[] = seedTasks.flatMap((t, i) => {
  if (rand() > 0.6) return [];
  const count = Math.floor(rand() * 3) + 1;
  return Array.from({ length: count }, (_, k) => ({
    id: `cmt-${t.id}-${k}`,
    taskId: t.id,
    authorId: employees[(i + k * 5) % employees.length]!.id,
    body: pick(COMMENT_BANK),
    createdAt: daysAgo(Math.floor(rand() * 10)),
  }));
});

export const seedActivity: TaskActivity[] = seedTasks.flatMap((t, i) => [
  {
    id: `act-${t.id}-created`,
    taskId: t.id,
    at: t.createdAt,
    actorId: t.reporterId,
    kind: "created" as const,
    summary: `Created ${t.ref}`,
  },
  ...(t.assigneeId
    ? [
        {
          id: `act-${t.id}-assign`,
          taskId: t.id,
          at: t.updatedAt,
          actorId: t.reporterId,
          kind: "assignee_changed" as const,
          summary: `Assigned to ${employees.find((e) => e.id === t.assigneeId)?.name ?? "—"}`,
        },
      ]
    : []),
  ...(i % 5 === 0
    ? [
        {
          id: `act-${t.id}-status`,
          taskId: t.id,
          at: t.updatedAt,
          actorId: t.assigneeId ?? t.reporterId,
          kind: "status_changed" as const,
          summary: `Status → ${t.status}`,
        },
      ]
    : []),
]);

// ---------- Saved filters ----------

export const seedSavedFilters: SavedFilter[] = [
  {
    id: "sf-my-open",
    name: "My open tasks",
    pinned: true,
    filters: { topLevelOnly: true, status: ["todo", "in_progress", "review", "qa"] },
    sort: { key: "priority", direction: "desc" },
    createdBy: employees[0]!.id,
    createdAt: daysAgo(30),
  },
  {
    id: "sf-overdue",
    name: "Overdue across teams",
    pinned: true,
    filters: { overdueOnly: true, topLevelOnly: true },
    sort: { key: "due", direction: "asc" },
    createdBy: employees[0]!.id,
    createdAt: daysAgo(25),
  },
  {
    id: "sf-critical",
    name: "Critical & high",
    pinned: true,
    filters: { priority: ["critical", "high"], status: ["todo", "in_progress", "review"] },
    sort: { key: "priority", direction: "desc" },
    createdBy: employees[1]!.id,
    createdAt: daysAgo(15),
  },
  {
    id: "sf-unassigned",
    name: "Unassigned backlog",
    pinned: false,
    filters: { unassignedOnly: true, status: ["backlog", "todo"] },
    createdBy: employees[2]!.id,
    createdAt: daysAgo(10),
  },
];

export const seedFavoriteIds: string[] = topLevel.slice(0, 4).map((t) => t.id);

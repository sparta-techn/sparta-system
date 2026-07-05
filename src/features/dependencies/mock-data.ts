import type { Dependency, Person } from "./types";

export const CURRENT_USER_ID = "u-me";

export const PEOPLE: Person[] = [
  { id: "u-me", name: "You (Aylin K.)", avatarColor: "primary", role: "Flutter Developer", department: "Mobile" },
  { id: "u-emir", name: "Emir Y.", avatarColor: "info", role: "Backend Engineer", department: "Backend" },
  { id: "u-sena", name: "Sena B.", avatarColor: "warning", role: "Product Designer", department: "Design" },
  { id: "u-can", name: "Can D.", avatarColor: "success", role: "QA Engineer", department: "QA" },
  { id: "u-mert", name: "Mert A.", avatarColor: "danger", role: "DevOps Engineer", department: "DevOps" },
  { id: "u-zeynep", name: "Zeynep T.", avatarColor: "primary", role: "Project Manager", department: "PMO" },
  { id: "u-ali", name: "Ali R.", avatarColor: "info", role: "Frontend Engineer", department: "Web" },
  { id: "u-deniz", name: "Deniz S.", avatarColor: "warning", role: "Product Manager", department: "Product" },
];

export const DEPARTMENTS = [
  "Mobile",
  "Backend",
  "Design",
  "QA",
  "DevOps",
  "PMO",
  "Web",
  "Product",
];

export const PROJECTS = [
  "Atlas Mobile v3",
  "Helios API Platform",
  "Orion Web Console",
  "Nova Design System",
  "Internal Tools",
];

function iso(daysAgo: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function isoIn(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export const MOCK_DEPENDENCIES: Dependency[] = [
  {
    id: "DEP-1042",
    title: "Need /v2/orders endpoint with pagination",
    description:
      "Atlas mobile checkout screen blocks until backend exposes the new paginated orders endpoint. Need cursor pagination and total count.",
    type: "backend_api",
    priority: "high",
    state: "in_progress",
    requesterId: "u-me",
    ownerId: "u-emir",
    department: "Backend",
    project: "Atlas Mobile v3",
    relatedTaskRef: "CU-8842",
    tags: ["checkout", "v3-release"],
    attachments: [{ id: "a1", name: "endpoint-spec.md", size: "12 KB" }],
    createdAt: iso(3, 10),
    updatedAt: iso(0, 11),
    dueAt: isoIn(2),
    comments: [
      { id: "c1", authorId: "u-emir", body: "Picked this up. Draft response shape coming today.", createdAt: iso(2, 14) },
      { id: "c2", authorId: "u-me", body: "Thanks @Emir Y. — please include `next_cursor`.", createdAt: iso(2, 15), mentions: ["u-emir"] },
      { id: "c3", authorId: "u-emir", body: "Moved to in progress. ETA tomorrow EOD.", createdAt: iso(0, 11), isStatusUpdate: true },
    ],
    activity: [
      { id: "ac1", kind: "created", actorId: "u-me", at: iso(3, 10) },
      { id: "ac2", kind: "assigned", actorId: "u-me", at: iso(3, 10), meta: { to: "u-emir" } },
      { id: "ac3", kind: "accepted", actorId: "u-emir", at: iso(2, 14) },
      { id: "ac4", kind: "status_changed", actorId: "u-emir", at: iso(0, 11), meta: { from: "accepted", to: "in_progress" } },
    ],
  },
  {
    id: "DEP-1041",
    title: "Empty-state illustrations for Atlas onboarding",
    description: "Three illustrations needed: no-orders, no-notifications, success. Match Nova design system tokens.",
    type: "ui_design",
    priority: "medium",
    state: "pending",
    requesterId: "u-me",
    ownerId: "u-sena",
    department: "Design",
    project: "Atlas Mobile v3",
    tags: ["onboarding"],
    attachments: [],
    createdAt: iso(1, 9),
    updatedAt: iso(1, 9),
    dueAt: isoIn(5),
    comments: [],
    activity: [{ id: "ac1", kind: "created", actorId: "u-me", at: iso(1, 9) }],
  },
  {
    id: "DEP-1039",
    title: "Staging env missing STRIPE_WEBHOOK_SECRET",
    description: "QA cycle blocked — webhook tests fail because the secret is not set on staging.",
    type: "devops",
    priority: "critical",
    state: "blocked",
    requesterId: "u-can",
    ownerId: "u-mert",
    department: "DevOps",
    project: "Helios API Platform",
    tags: ["staging", "blocker"],
    attachments: [],
    createdAt: iso(2, 8),
    updatedAt: iso(0, 9),
    dueAt: isoIn(0),
    comments: [
      { id: "c1", authorId: "u-mert", body: "Vault rotation in progress, ping security.", createdAt: iso(0, 9), isStatusUpdate: true },
    ],
    activity: [
      { id: "ac1", kind: "created", actorId: "u-can", at: iso(2, 8) },
      { id: "ac2", kind: "accepted", actorId: "u-mert", at: iso(2, 10) },
      { id: "ac3", kind: "status_changed", actorId: "u-mert", at: iso(0, 9), meta: { from: "in_progress", to: "blocked" } },
    ],
  },
  {
    id: "DEP-1037",
    title: "Confirm pricing copy for Pro plan",
    description: "Need final wording from product before localization handoff.",
    type: "product_decision",
    priority: "medium",
    state: "accepted",
    requesterId: "u-ali",
    ownerId: "u-deniz",
    department: "Product",
    project: "Orion Web Console",
    tags: ["pricing", "copy"],
    attachments: [],
    createdAt: iso(4, 11),
    updatedAt: iso(2, 16),
    dueAt: isoIn(3),
    comments: [],
    activity: [
      { id: "ac1", kind: "created", actorId: "u-ali", at: iso(4, 11) },
      { id: "ac2", kind: "accepted", actorId: "u-deniz", at: iso(2, 16) },
    ],
  },
  {
    id: "DEP-1031",
    title: "Regression suite for checkout flow",
    description: "Need updated regression scenarios covering the new v3 checkout.",
    type: "qa",
    priority: "high",
    state: "in_progress",
    requesterId: "u-zeynep",
    ownerId: "u-can",
    department: "QA",
    project: "Atlas Mobile v3",
    tags: ["regression"],
    attachments: [],
    createdAt: iso(6, 9),
    updatedAt: iso(1, 17),
    dueAt: isoIn(1),
    comments: [],
    activity: [
      { id: "ac1", kind: "created", actorId: "u-zeynep", at: iso(6, 9) },
      { id: "ac2", kind: "accepted", actorId: "u-can", at: iso(5, 10) },
      { id: "ac3", kind: "status_changed", actorId: "u-can", at: iso(1, 17), meta: { from: "accepted", to: "in_progress" } },
    ],
  },
  {
    id: "DEP-1024",
    title: "Database index on orders.created_at",
    description: "Reports page timing out — need a btree index.",
    type: "database",
    priority: "high",
    state: "resolved",
    requesterId: "u-ali",
    ownerId: "u-emir",
    department: "Backend",
    project: "Orion Web Console",
    tags: ["performance"],
    attachments: [],
    createdAt: iso(9, 9),
    updatedAt: iso(2, 12),
    dueAt: isoIn(-3),
    resolvedAt: iso(2, 12),
    comments: [
      { id: "c1", authorId: "u-emir", body: "Index shipped, p95 down from 4.2s to 180ms.", createdAt: iso(2, 12), isStatusUpdate: true },
    ],
    activity: [
      { id: "ac1", kind: "created", actorId: "u-ali", at: iso(9, 9) },
      { id: "ac2", kind: "accepted", actorId: "u-emir", at: iso(8, 10) },
      { id: "ac3", kind: "resolved", actorId: "u-emir", at: iso(2, 12) },
    ],
  },
  {
    id: "DEP-1018",
    title: "Client approval on onboarding flow",
    description: "Awaiting written sign-off from client stakeholder.",
    type: "client_feedback",
    priority: "medium",
    state: "pending",
    requesterId: "u-zeynep",
    ownerId: "u-deniz",
    department: "Product",
    project: "Atlas Mobile v3",
    tags: ["client"],
    attachments: [],
    createdAt: iso(2, 10),
    updatedAt: iso(2, 10),
    dueAt: isoIn(-1),
    comments: [],
    activity: [{ id: "ac1", kind: "created", actorId: "u-zeynep", at: iso(2, 10) }],
  },
  {
    id: "DEP-1015",
    title: "Auth middleware shared package",
    description: "Frontend needs the shared auth middleware published to internal registry.",
    type: "frontend",
    priority: "low",
    state: "closed",
    requesterId: "u-ali",
    ownerId: "u-emir",
    department: "Backend",
    project: "Internal Tools",
    tags: [],
    attachments: [],
    createdAt: iso(14, 9),
    updatedAt: iso(7, 12),
    resolvedAt: iso(7, 12),
    comments: [],
    activity: [
      { id: "ac1", kind: "created", actorId: "u-ali", at: iso(14, 9) },
      { id: "ac2", kind: "resolved", actorId: "u-emir", at: iso(8, 14) },
      { id: "ac3", kind: "closed", actorId: "u-ali", at: iso(7, 12) },
    ],
  },
  {
    id: "DEP-1012",
    title: "Security review for payment SDK",
    description: "Need security team review before integrating new SDK.",
    type: "security",
    priority: "critical",
    state: "pending",
    requesterId: "u-me",
    ownerId: "u-mert",
    department: "DevOps",
    project: "Atlas Mobile v3",
    tags: ["payments", "review"],
    attachments: [{ id: "a1", name: "sdk-changelog.pdf", size: "84 KB" }],
    createdAt: iso(0, 8),
    updatedAt: iso(0, 8),
    dueAt: isoIn(4),
    comments: [],
    activity: [{ id: "ac1", kind: "created", actorId: "u-me", at: iso(0, 8) }],
  },
];

export function personById(id: string | null | undefined): Person | undefined {
  if (!id) return undefined;
  return PEOPLE.find((p) => p.id === id);
}

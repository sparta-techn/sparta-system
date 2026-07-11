import { employees, type Department } from "@/features/hr/mock-data";
import type {
  ActivityEvent,
  Milestone,
  Project,
  ProjectFile,
  ProjectTemplate,
  WorkspaceSettings,
} from "./types";

function pickEmployee(i: number) {
  return employees[i % employees.length];
}

function membersSlice(start: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const emp = pickEmployee(start + i);
    return {
      employeeId: emp.id,
      projectRole:
        i === 0 ? ("lead" as const) : i === 1 ? ("reviewer" as const) : ("contributor" as const),
    };
  });
}

// Clients are Supabase-backed (see features/projects/store.ts + the `clients`
// table, migration 20260711120000) — no mock seed lives here anymore.

export const projectTemplates: ProjectTemplate[] = [
  {
    id: "tpl-flutter",
    name: "Flutter App",
    description: "Cross-platform mobile app with CI/CD, store releases, and analytics.",
    icon: "📱",
    color: "#3B82F6",
    defaultStatuses: ["Backlog", "In Design", "In Dev", "QA", "Released"],
    defaultMilestones: ["MVP", "Beta", "Public Launch"],
    defaultRoles: ["lead", "contributor", "reviewer"],
    recommendedDuration: 120,
    usageCount: 14,
  },
  {
    id: "tpl-backend",
    name: "Backend API",
    description: "Service-oriented API project with infra, observability, and load testing.",
    icon: "🛠️",
    color: "#10B981",
    defaultStatuses: ["Spec", "Building", "Review", "Deployed"],
    defaultMilestones: ["Schema frozen", "Internal alpha", "GA"],
    defaultRoles: ["lead", "contributor", "reviewer"],
    recommendedDuration: 90,
    usageCount: 22,
  },
  {
    id: "tpl-website",
    name: "Website",
    description: "Marketing or content site with CMS, SEO, and launch checklist.",
    icon: "🌐",
    color: "#F59E0B",
    defaultStatuses: ["Wireframe", "Design", "Build", "QA", "Live"],
    defaultMilestones: ["Design freeze", "Soft launch", "Public launch"],
    defaultRoles: ["lead", "contributor"],
    recommendedDuration: 45,
    usageCount: 18,
  },
  {
    id: "tpl-admin",
    name: "Admin Dashboard",
    description: "Internal operations dashboard with RBAC, audit logs, and reporting.",
    icon: "📊",
    color: "#8B5CF6",
    defaultStatuses: ["Backlog", "In Progress", "Review", "Done"],
    defaultMilestones: ["Auth + shell", "Core modules", "Reports", "Handover"],
    defaultRoles: ["lead", "contributor", "reviewer"],
    recommendedDuration: 75,
    usageCount: 9,
  },
  {
    id: "tpl-internal",
    name: "Internal Tool",
    description: "Lightweight internal utility with minimal ceremony.",
    icon: "⚙️",
    color: "#64748B",
    defaultStatuses: ["Todo", "Doing", "Done"],
    defaultMilestones: ["v1"],
    defaultRoles: ["lead", "contributor"],
    recommendedDuration: 21,
    usageCount: 31,
  },
];

const PROJECTS_SEED: Array<Partial<Project> & Pick<Project, "id" | "key" | "name">> = [
  {
    id: "proj-etihad-bus",
    key: "ETB",
    name: "Etihad Bus",
    description:
      "Operations platform for the Etihad public bus fleet — driver app, control room, and rider notifications.",
    clientId: "cli-etihad",
    department: "Engineering",
    startDate: "2025-01-08",
    endDate: "2026-04-30",
    priority: "high",
    status: "active",
    health: "at_risk",
    color: "#3B82F6",
    icon: "🚌",
    repositoryUrl: "https://github.com/spartaflow/etihad-bus",
    figmaUrl: "https://figma.com/file/etihad-bus",
    apiDocsUrl: "https://docs.spartaflow.com/etihad-bus",
    environments: [
      { label: "Production", url: "https://etihad-bus.app" },
      { label: "Staging", url: "https://staging.etihad-bus.app" },
    ],
    progress: 62,
    openTasks: 48,
    completedTasks: 211,
    overdueTasks: 6,
    totalTasks: 259,
    openDependencies: 4,
    templateId: "tpl-flutter",
  },
  {
    id: "proj-laundry",
    key: "LDY",
    name: "Brightwash Laundry Platform",
    description:
      "Consumer mobile laundry booking with driver dispatch and partner store integration.",
    clientId: "cli-laundromat",
    department: "Engineering",
    startDate: "2025-02-15",
    endDate: "2025-09-30",
    priority: "critical",
    status: "active",
    health: "blocked",
    color: "#F59E0B",
    icon: "🧺",
    repositoryUrl: "https://github.com/spartaflow/brightwash",
    environments: [{ label: "Staging", url: "https://staging.brightwash.app" }],
    progress: 41,
    openTasks: 72,
    completedTasks: 96,
    overdueTasks: 11,
    totalTasks: 168,
    openDependencies: 7,
    templateId: "tpl-flutter",
  },
  {
    id: "proj-engineering-portal",
    key: "EP",
    name: "Engineering Portal",
    description: "Internal developer portal — runbooks, on-call, service catalog.",
    clientId: "cli-internal",
    department: "DevOps",
    startDate: "2024-10-01",
    endDate: "2025-12-01",
    priority: "medium",
    status: "active",
    health: "healthy",
    color: "#8B5CF6",
    icon: "🛰️",
    repositoryUrl: "https://github.com/spartaflow/eng-portal",
    environments: [{ label: "Production", url: "https://eng.spartaflow.dev" }],
    progress: 78,
    openTasks: 22,
    completedTasks: 154,
    overdueTasks: 1,
    totalTasks: 176,
    openDependencies: 1,
    templateId: "tpl-admin",
  },
  {
    id: "proj-banking",
    key: "FNX",
    name: "FinX Mobile Banking",
    description: "Neobank super-app with savings, transfers, and card management.",
    clientId: "cli-finx",
    department: "Engineering",
    startDate: "2024-11-12",
    endDate: "2026-02-28",
    priority: "critical",
    status: "active",
    health: "delayed",
    color: "#10B981",
    icon: "🏦",
    repositoryUrl: "https://github.com/spartaflow/finx",
    figmaUrl: "https://figma.com/file/finx",
    environments: [
      { label: "Production", url: "https://finx.app" },
      { label: "Staging", url: "https://staging.finx.app" },
      { label: "Sandbox", url: "https://sandbox.finx.app" },
    ],
    progress: 35,
    openTasks: 142,
    completedTasks: 188,
    overdueTasks: 18,
    totalTasks: 330,
    openDependencies: 9,
    templateId: "tpl-flutter",
  },
  {
    id: "proj-crm",
    key: "CRM",
    name: "Internal CRM System",
    description: "Sales and account-management CRM tailored to the SpartaFlow pipeline.",
    clientId: "cli-internal",
    department: "Product",
    startDate: "2024-08-01",
    endDate: "2025-07-30",
    priority: "medium",
    status: "on_hold",
    health: "at_risk",
    color: "#EC4899",
    icon: "📇",
    repositoryUrl: "https://github.com/spartaflow/crm",
    environments: [],
    progress: 28,
    openTasks: 14,
    completedTasks: 52,
    overdueTasks: 3,
    totalTasks: 66,
    openDependencies: 2,
    templateId: "tpl-admin",
  },
  {
    id: "proj-marketing-site",
    key: "WEB",
    name: "SpartaFlow Marketing Site",
    description: "Redesign of the public spartaflow.com marketing site.",
    clientId: "cli-internal",
    department: "Marketing",
    startDate: "2024-06-01",
    endDate: "2024-09-15",
    priority: "low",
    status: "completed",
    health: "completed",
    color: "#0EA5E9",
    icon: "🌐",
    environments: [{ label: "Production", url: "https://spartaflow.com" }],
    progress: 100,
    openTasks: 0,
    completedTasks: 86,
    overdueTasks: 0,
    totalTasks: 86,
    openDependencies: 0,
    templateId: "tpl-website",
  },
];

export const seedProjects: Project[] = PROJECTS_SEED.map((p, idx) => {
  const memberCount = 4 + (idx % 5);
  const manager = pickEmployee(idx + 2);
  return {
    members: membersSlice(idx, memberCount),
    managerId: manager.id,
    favorite: idx < 2,
    createdAt: new Date(Date.now() - idx * 86400000 * 18).toISOString(),
    environments: [],
    department: "Engineering" as Department,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    priority: "medium",
    status: "active",
    health: "healthy",
    color: "#3B82F6",
    icon: "📦",
    progress: 0,
    openTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalTasks: 0,
    openDependencies: 0,
    description: "",
    clientId: null,
    ...p,
  } as Project;
});

export const seedMilestones: Milestone[] = seedProjects.flatMap((p) => {
  const tpl = projectTemplates.find((t) => t.id === p.templateId);
  const list = tpl?.defaultMilestones ?? ["Kickoff", "Build", "Launch"];
  return list.map((name, i) => {
    const total = list.length;
    const ratio = (i + 1) / total;
    const status: Milestone["status"] =
      ratio * 100 <= p.progress
        ? "done"
        : i === Math.floor((p.progress / 100) * total)
          ? "in_progress"
          : "upcoming";
    const dueOffset = Math.round((i + 1) * 25);
    return {
      id: `${p.id}-ms-${i}`,
      projectId: p.id,
      name,
      dueDate: new Date(Date.now() + dueOffset * 86400000).toISOString().slice(0, 10),
      status,
      progress: status === "done" ? 100 : status === "in_progress" ? 55 : 0,
    };
  });
});

export const seedActivity: ActivityEvent[] = seedProjects.flatMap((p, i) => {
  const m = p.members[0]?.employeeId ?? p.managerId;
  return [
    {
      id: `${p.id}-act-1`,
      projectId: p.id,
      at: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
      actorId: m,
      type: "report_filed",
      summary: `Filed weekly status report`,
    },
    {
      id: `${p.id}-act-2`,
      projectId: p.id,
      at: new Date(Date.now() - (i + 2) * 7200000).toISOString(),
      actorId: p.managerId,
      type: "milestone_reached",
      summary: `Milestone "${seedMilestones.find((ms) => ms.projectId === p.id)?.name ?? "Kickoff"}" updated`,
    },
    {
      id: `${p.id}-act-3`,
      projectId: p.id,
      at: new Date(Date.now() - (i + 3) * 10800000).toISOString(),
      actorId: m,
      type: "file_uploaded",
      summary: `Uploaded spec.pdf`,
    },
  ] satisfies ActivityEvent[];
});

export const seedFiles: ProjectFile[] = seedProjects.flatMap((p, i) => [
  {
    id: `${p.id}-f1`,
    projectId: p.id,
    name: "scope-of-work.pdf",
    size: 482_104,
    uploadedBy: p.managerId,
    uploadedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    kind: "doc",
  },
  {
    id: `${p.id}-f2`,
    projectId: p.id,
    name: "wireframes-v2.fig",
    size: 2_104_882,
    uploadedBy: p.members[1]?.employeeId ?? p.managerId,
    uploadedAt: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
    kind: "design",
  },
  {
    id: `${p.id}-f3`,
    projectId: p.id,
    name: "api-contract.yaml",
    size: 38_211,
    uploadedBy: p.members[0]?.employeeId ?? p.managerId,
    uploadedAt: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
    kind: "spec",
  },
]);

export const defaultWorkspace: WorkspaceSettings = {
  companyName: "SpartaFlow",
  logoInitial: "S",
  timezone: "Asia/Dubai",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  workingHours: { start: "09:00", end: "18:00" },
  languages: ["English", "Arabic"],
  defaultStatuses: ["Backlog", "In Progress", "Review", "Done"],
  defaultProjectTemplate: "tpl-backend",
};

export const PROJECT_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#0EA5E9",
  "#EF4444",
  "#64748B",
];

export const PROJECT_ICONS = [
  "📦",
  "📱",
  "🛠️",
  "🌐",
  "📊",
  "⚙️",
  "🚌",
  "🧺",
  "🏦",
  "📇",
  "🛰️",
  "🚀",
];

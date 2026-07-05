import type { PlannedTask } from "./types";

export interface MockDepartment {
  id: string;
  name: string;
}

export interface MockEmployee {
  id: string;
  name: string;
  initials: string;
  role: string;
  departmentId: string;
}

export const MOCK_DEPARTMENTS: MockDepartment[] = [
  { id: "eng", name: "Engineering" },
  { id: "design", name: "Design" },
  { id: "product", name: "Product" },
  { id: "qa", name: "Quality" },
  { id: "devops", name: "DevOps" },
  { id: "hr", name: "People Ops" },
];

export const MOCK_EMPLOYEES: MockEmployee[] = [
  { id: "u1", name: "Lena Volkov", initials: "LV", role: "Design Lead", departmentId: "design" },
  { id: "u2", name: "Omar Said", initials: "OS", role: "Backend Engineer", departmentId: "eng" },
  { id: "u3", name: "Ana Petrova", initials: "AP", role: "Platform Engineer", departmentId: "eng" },
  { id: "u4", name: "Marek Jansen", initials: "MJ", role: "QA Engineer", departmentId: "qa" },
  { id: "u5", name: "Sara Khan", initials: "SK", role: "Product Manager", departmentId: "product" },
  { id: "u6", name: "Diego Ramos", initials: "DR", role: "Frontend Engineer", departmentId: "eng" },
  { id: "u7", name: "Yuki Tanaka", initials: "YT", role: "Data Engineer", departmentId: "eng" },
  { id: "u8", name: "Noor Hassan", initials: "NH", role: "DevOps Engineer", departmentId: "devops" },
];

/** Mocked "planned tasks" — future-proof for ClickUp integration. */
export const MOCK_PLANNED_TASKS: PlannedTask[] = [
  {
    id: "T-1042",
    title: "Refactor onboarding wizard state machine",
    project: "Onboarding",
    source: "clickup",
    priority: "high",
    deadline: "Today · 18:00",
  },
  {
    id: "T-1051",
    title: "Review PR #284 — Reports cursor pagination",
    project: "Platform",
    source: "clickup",
    priority: "medium",
    deadline: "Tomorrow",
  },
  {
    id: "T-1038",
    title: "Fix flaky e2e: invite acceptance flow",
    project: "QA",
    source: "clickup",
    priority: "urgent",
    deadline: "Today · 14:00",
  },
  {
    id: "T-1061",
    title: "Spike: realtime channel partitioning",
    project: "Platform",
    source: "clickup",
    priority: "medium",
  },
  {
    id: "T-1064",
    title: "Polish dashboard empty states",
    project: "Design",
    source: "clickup",
    priority: "low",
  },
];

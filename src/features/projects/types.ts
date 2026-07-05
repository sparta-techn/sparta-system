import type { Department } from "@/features/hr/mock-data";

export type ProjectStatus =
  "planning" | "active" | "on_hold" | "completed" | "archived" | "cancelled";

export type ProjectHealth = "healthy" | "at_risk" | "blocked" | "delayed" | "completed";

export type ProjectPriority = "low" | "medium" | "high" | "critical";

export type ProjectRole = "lead" | "contributor" | "reviewer" | "stakeholder";

export interface EnvironmentLink {
  label: string; // "Production", "Staging"
  url: string;
}

export interface ProjectMember {
  employeeId: string;
  projectRole: ProjectRole;
}

/**
 * A resolved person from the Supabase `profiles` directory, shaped to be a
 * drop-in for the avatar/name reads the projects UI previously did against
 * `hr/mock-data` (`employeeById`).
 */
export interface Person {
  id: string;
  name: string;
  initials: string;
  avatarHue: number;
  jobTitle: string;
  department: string;
}

export interface Project {
  id: string;
  key: string; // e.g. "ETB"
  name: string;
  description: string;
  clientId: string | null;
  managerId: string;
  members: ProjectMember[];
  department: Department;
  startDate: string; // ISO
  endDate: string; // ISO
  priority: ProjectPriority;
  status: ProjectStatus;
  health: ProjectHealth;
  color: string; // hex or token
  icon: string; // emoji or lucide name
  repositoryUrl?: string;
  figmaUrl?: string;
  apiDocsUrl?: string;
  environments: EnvironmentLink[];
  // derived/mock progress signals
  progress: number; // 0-100
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalTasks: number;
  openDependencies: number;
  templateId?: string;
  favorite: boolean;
  archivedAt?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  company: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  logoHue: number;
  projects: string[]; // project ids
  createdAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultStatuses: string[];
  defaultMilestones: string[];
  defaultRoles: ProjectRole[];
  recommendedDuration: number; // days
  usageCount: number;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  at: string;
  actorId: string;
  type:
    | "project_created"
    | "status_changed"
    | "member_added"
    | "member_removed"
    | "file_uploaded"
    | "milestone_reached"
    | "report_filed";
  summary: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  kind: "doc" | "image" | "design" | "spec" | "other";
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  dueDate: string;
  status: "upcoming" | "in_progress" | "done" | "missed";
  progress: number;
}

export type RiskStatus = "open" | "mitigating" | "resolved" | "accepted" | "closed";

export interface Risk {
  id: string;
  projectId: string;
  title: string;
  severity: ProjectPriority;
  likelihood: ProjectPriority;
  status: RiskStatus;
}

export interface WorkspaceSettings {
  companyName: string;
  logoInitial: string;
  timezone: string;
  workingDays: string[]; // "Mon","Tue"...
  workingHours: { start: string; end: string };
  languages: string[];
  defaultStatuses: string[];
  defaultProjectTemplate: string | null;
}

import { seedProjects } from "@/features/projects/mock-data";
import type { Sprint } from "./types";

function daysFromNow(d: number): string {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

const TEMPLATES: Array<Pick<Sprint, "name" | "goal" | "status"> & { offset: number; len: number; cap: number }> = [
  {
    name: "Sprint 1 · Authentication",
    goal: "Ship invite-only auth, role gating, and session hardening across the platform.",
    status: "completed",
    offset: -28,
    len: 14,
    cap: 42,
  },
  {
    name: "Sprint 2 · Core Features",
    goal: "Land attendance, daily check-in, and dependency tracking MVP for pilot teams.",
    status: "active",
    offset: -7,
    len: 14,
    cap: 48,
  },
  {
    name: "Sprint 3 · UI Polish",
    goal: "Refine the design system, fix top accessibility issues, and ship empty states.",
    status: "planned",
    offset: 7,
    len: 14,
    cap: 36,
  },
];

export const seedSprints: Sprint[] = seedProjects.slice(0, 3).flatMap((project, pIdx) =>
  TEMPLATES.map((t, tIdx) => ({
    id: `${project.id}-sprint-${tIdx + 1}`,
    name: t.name,
    projectId: project.id,
    startDate: daysFromNow(t.offset + pIdx * 2),
    endDate: daysFromNow(t.offset + t.len + pIdx * 2),
    status: t.status,
    goal: t.goal,
    capacity: t.cap,
    createdAt: daysFromNow(t.offset + pIdx * 2 - 3),
  })),
);

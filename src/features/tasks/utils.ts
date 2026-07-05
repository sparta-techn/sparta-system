import { employees } from "@/features/hr/mock-data";
import { seedProjects } from "@/features/projects/mock-data";
import type { Task } from "./types";

export function employeeById(id: string | null | undefined) {
  if (!id) return null;
  return employees.find((e) => e.id === id) ?? null;
}

export function projectById(id: string) {
  return seedProjects.find((p) => p.id === id) ?? null;
}

export function isOverdue(task: Task) {
  if (!task.dueDate) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatRelative(value?: string | null) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const day = 86_400_000;
  if (Math.abs(diff) < day) return diff > 0 ? "today" : "tomorrow";
  const days = Math.round(diff / day);
  if (days > 0) return `${days}d ago`;
  return `in ${Math.abs(days)}d`;
}

export function checklistProgress(task: Task) {
  if (!task.checklist.length) return null;
  const done = task.checklist.filter((c) => c.done).length;
  return { done, total: task.checklist.length, pct: Math.round((done / task.checklist.length) * 100) };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

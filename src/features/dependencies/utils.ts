import type { Dependency, DependencyState } from "./types";

export function isOverdue(d: Dependency) {
  if (!d.dueAt) return false;
  if (d.state === "resolved" || d.state === "closed" || d.state === "cancelled") return false;
  return new Date(d.dueAt).getTime() < Date.now();
}

export function isOpen(d: Dependency) {
  return !["resolved", "closed", "cancelled", "rejected"].includes(d.state);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function dueLabel(d: Dependency) {
  if (!d.dueAt) return "No due date";
  const diff = new Date(d.dueAt).getTime() - Date.now();
  const day = Math.round(diff / 86400000);
  if (day < 0) return `Overdue by ${Math.abs(day)}d`;
  if (day === 0) return "Due today";
  if (day === 1) return "Due tomorrow";
  return `Due in ${day}d`;
}

export function avgResolutionHours(items: Dependency[]) {
  const done = items.filter((d) => d.resolvedAt);
  if (!done.length) return 0;
  const total = done.reduce(
    (acc, d) => acc + (new Date(d.resolvedAt!).getTime() - new Date(d.createdAt).getTime()),
    0,
  );
  return Math.round(total / done.length / 3600000);
}

export function groupByState(items: Dependency[]) {
  const map = new Map<DependencyState, Dependency[]>();
  items.forEach((d) => {
    const arr = map.get(d.state) ?? [];
    arr.push(d);
    map.set(d.state, arr);
  });
  return map;
}

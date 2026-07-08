/**
 * Pure helpers: aggregations, formatting, ranges.
 */
import type { TimeLog, TimeRange } from "./types";

const MS_PER_MIN = 60_000;

export function liveDurationMinutes(log: TimeLog, now = Date.now()): number {
  if (log.endTime) return log.durationMinutes ?? 0;
  return Math.max(0, Math.floor((now - new Date(log.startTime).getTime()) / MS_PER_MIN));
}

export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function liveSeconds(log: TimeLog, now = Date.now()): number {
  if (log.endTime) return Math.floor((log.durationMinutes ?? 0) * 60);
  return Math.max(0, Math.floor((now - new Date(log.startTime).getTime()) / 1000));
}

export function isInRange(iso: string, range: TimeRange, now = new Date()): boolean {
  const d = new Date(iso);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "today") {
    return d >= start;
  }
  if (range === "week") {
    const day = (start.getDay() + 6) % 7; // Monday-start
    start.setDate(start.getDate() - day);
    return d >= start;
  }
  // month
  start.setDate(1);
  return d >= start;
}

export function sumMinutes(logs: TimeLog[], now = Date.now()): number {
  return logs.reduce((acc, l) => acc + liveDurationMinutes(l, now), 0);
}

export function groupByTask(logs: TimeLog[]): Map<string, TimeLog[]> {
  const map = new Map<string, TimeLog[]>();
  logs.forEach((l) => {
    const arr = map.get(l.taskId) ?? [];
    arr.push(l);
    map.set(l.taskId, arr);
  });
  return map;
}

export function groupByDay(logs: TimeLog[]): { date: string; minutes: number }[] {
  const map = new Map<string, number>();
  logs.forEach((l) => {
    const key = new Date(l.startTime).toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + liveDurationMinutes(l));
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, minutes]) => ({ date, minutes }));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

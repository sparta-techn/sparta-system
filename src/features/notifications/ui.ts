/**
 * Shared presentation helpers for notifications. Centralises icon, tone,
 * and time formatting so widgets/dropdown/center render consistently.
 */

import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Info,
  ListChecks,
  MessageSquare,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type { AppNotification, NotificationType, PreferenceCategory } from "./types";

const CATEGORY_ICON: Record<PreferenceCategory, LucideIcon> = {
  attendance: CalendarClock,
  dependencies: Workflow,
  announcements: Megaphone,
  reports: ClipboardCheck,
  mentions: MessageSquare,
  system: ShieldAlert,
  tasks: ListChecks,
  approvals: BadgeCheck,
};

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: ShieldAlert,
  reminder: Bell,
};

export function iconFor(n: AppNotification): LucideIcon {
  if (n.type === "critical" || n.type === "warning") return TYPE_ICON[n.type];
  if (n.eventName.startsWith("dependency.")) return Workflow;
  if (n.eventName.startsWith("announcement.")) return Megaphone;
  if (n.eventName.startsWith("attendance.")) return CalendarClock;
  if (n.category === "mentions") return MessageSquare;
  if (n.category === "reports") return ClipboardCheck;
  if (n.eventName === "user.invited") return Sparkles;
  return CATEGORY_ICON[n.category] ?? Bell;
}

export function toneClass(type: NotificationType): string {
  switch (type) {
    case "success":
      return "text-success bg-success/10";
    case "warning":
      return "text-warning bg-warning/10";
    case "critical":
      return "text-destructive bg-destructive/10";
    case "reminder":
      return "text-primary bg-primary/10";
    case "info":
    default:
      return "text-foreground bg-muted";
  }
}

export function formatRelative(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export type Bucket = "today" | "yesterday" | "earlier";

export function bucketOf(iso: string, now = new Date()): Bucket {
  const d = new Date(iso);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  if (d.getTime() >= startToday.getTime()) return "today";
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (d.getTime() >= startYesterday.getTime()) return "yesterday";
  return "earlier";
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
};

export const CATEGORY_LABEL: Record<PreferenceCategory, string> = {
  attendance: "Attendance",
  dependencies: "Dependencies",
  announcements: "Announcements",
  reports: "Reports",
  mentions: "Mentions",
  system: "System",
  tasks: "Tasks & sprints",
  approvals: "Approvals",
};

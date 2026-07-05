import type { AuditAction, AuditEvent } from "./types";
import { ACTION_CATEGORY } from "./types";

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();

interface SeedSpec {
  at: string;
  actor: string;
  actorId: string | null;
  action: AuditAction;
  target: string;
  targetType?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

const SEED: SeedSpec[] = [
  {
    at: minsAgo(3),
    actor: "Amelia Rivera",
    actorId: "emp_001",
    action: "login",
    target: "amelia.rivera@spartaflow.dev",
    targetType: "session",
  },
  {
    at: minsAgo(18),
    actor: "kai.murphy@spartaflow.dev",
    actorId: null,
    action: "failed_login",
    target: "kai.murphy@spartaflow.dev",
    targetType: "session",
    newValue: "Invalid credentials",
  },
  {
    at: minsAgo(52),
    actor: "Amelia Rivera",
    actorId: "emp_001",
    action: "role_changed",
    target: "Owen Lee",
    targetType: "employee",
    oldValue: "Employee",
    newValue: "Team Lead",
  },
  {
    at: minsAgo(140),
    actor: "Amelia Rivera",
    actorId: "emp_001",
    action: "employee_created",
    target: "River Song",
    targetType: "employee",
    newValue: "Engineering · Employee",
  },
  {
    at: minsAgo(320),
    actor: "Jonas Becker",
    actorId: "emp_002",
    action: "settings_changed",
    target: "Invitation settings",
    targetType: "settings",
    oldValue: "7 days",
    newValue: "14 days",
  },
  {
    at: minsAgo(480),
    actor: "Amelia Rivera",
    actorId: "emp_001",
    action: "permission_changed",
    target: "HR role",
    targetType: "role",
    oldValue: "analytics.view",
    newValue: "analytics.view, reports.review",
  },
  {
    at: minsAgo(700),
    actor: "Amelia Rivera",
    actorId: "emp_001",
    action: "project_deleted",
    target: "Legacy Migration",
    targetType: "project",
    oldValue: "active",
    newValue: "archived",
  },
  {
    at: minsAgo(900),
    actor: "Priya Nair",
    actorId: "emp_003",
    action: "logout",
    target: "priya.nair@spartaflow.dev",
    targetType: "session",
  },
  {
    at: minsAgo(1440),
    actor: "Amelia Rivera",
    actorId: "emp_001",
    action: "employee_deleted",
    target: "Sam Gold",
    targetType: "employee",
    oldValue: "active",
  },
];

/** Deterministic seed events so the viewer renders before any live actions. */
export function seedAuditEvents(): AuditEvent[] {
  return SEED.map((s, i) => ({
    id: `aud_seed_${i}`,
    at: s.at,
    actorId: s.actorId,
    actor: s.actor,
    action: s.action,
    category: ACTION_CATEGORY[s.action],
    target: s.target,
    targetType: s.targetType,
    oldValue: s.oldValue ?? null,
    newValue: s.newValue ?? null,
    ip: null,
    device: null,
  }));
}

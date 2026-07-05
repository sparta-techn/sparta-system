/**
 * Directory abstraction used by the automation engine to resolve recipient
 * rules into concrete user ids. The current implementation is mock; a
 * real implementation would query Supabase.
 */

import { PEOPLE } from "@/features/dependencies/mock-data";

import { getNotificationUserId } from "./store";
import type { RecipientRule } from "./types";

export interface DirectoryUser {
  id: string;
  name: string;
  role: "employee" | "manager" | "hr" | "owner";
  department: string;
  /** Manager of this user (single, optional). */
  managerId?: string;
}

// Synthesize role/manager metadata over the existing PEOPLE mock.
const ROLE_BY_ID: Record<string, DirectoryUser["role"]> = {
  "u-me": "employee",
  "u-emir": "employee",
  "u-sena": "employee",
  "u-can": "employee",
  "u-mert": "employee",
  "u-zeynep": "manager",
  "u-ali": "employee",
  "u-deniz": "manager",
  "u-hr": "hr",
  "u-owner": "owner",
};

const EXTRAS: DirectoryUser[] = [
  { id: "u-hr", name: "Pelin O.", role: "hr", department: "People" },
  { id: "u-owner", name: "Kerem V.", role: "owner", department: "Leadership" },
];

const PRIMARY_MANAGER = "u-zeynep";

export const directory: DirectoryUser[] = [
  ...PEOPLE.map((p) => ({
    id: p.id,
    name: p.name,
    role: ROLE_BY_ID[p.id] ?? "employee",
    department: p.department,
    managerId: ROLE_BY_ID[p.id] === "manager" ? undefined : PRIMARY_MANAGER,
  })),
  ...EXTRAS,
];

export function getUser(id: string): DirectoryUser | undefined {
  return directory.find((u) => u.id === id);
}

/** The signed-in user id (from auth, via the notification store), or "" if none. */
export function getCurrentUserId(): string {
  return getNotificationUserId() ?? "";
}

export function resolveRecipients(rules: RecipientRule[]): string[] {
  const set = new Set<string>();
  for (const rule of rules) {
    switch (rule.kind) {
      case "employee":
      case "user":
        set.add(rule.userId);
        break;
      case "manager": {
        const u = getUser(rule.ofUserId);
        if (u?.managerId) set.add(u.managerId);
        break;
      }
      case "hr":
        directory.filter((u) => u.role === "hr").forEach((u) => set.add(u.id));
        break;
      case "owner":
        directory.filter((u) => u.role === "owner").forEach((u) => set.add(u.id));
        break;
      case "department":
        directory
          .filter((u) => u.department.toLowerCase() === rule.department.toLowerCase())
          .forEach((u) => set.add(u.id));
        break;
      case "role":
        directory.filter((u) => u.role === rule.role).forEach((u) => set.add(u.id));
        break;
    }
  }
  return [...set];
}

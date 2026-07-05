import { useSyncExternalStore } from "react";
import { CURRENT_USER_ID, MOCK_DEPENDENCIES } from "./mock-data";
import type {
  Dependency,
  DependencyComment,
  DependencyPriority,
  DependencyState,
  DependencyType,
} from "./types";

/**
 * Local mock store. Single source of truth for the Dependency module UI.
 * Backend integration plug-in point: replace these functions with API calls
 * (e.g. Supabase RPCs) — the React surface stays identical.
 */

let items: Dependency[] = [...MOCK_DEPENDENCIES];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function nowIso() {
  return new Date().toISOString();
}

function nextId() {
  const max = items.reduce((acc, d) => {
    const n = Number(d.id.replace(/[^0-9]/g, "")) || 0;
    return Math.max(acc, n);
  }, 1000);
  return `DEP-${max + 1}`;
}

export const dependencyStore = {
  list(): Dependency[] {
    return items;
  },
  get(id: string): Dependency | undefined {
    return items.find((d) => d.id === id);
  },
  create(input: {
    title: string;
    description: string;
    type: DependencyType;
    priority: DependencyPriority;
    department: string;
    ownerId: string | null;
    project: string;
    relatedTaskRef?: string | null;
    dueAt?: string | null;
    tags: string[];
    asDraft?: boolean;
  }): Dependency {
    const id = nextId();
    const at = nowIso();
    const dep: Dependency = {
      id,
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority,
      state: input.asDraft ? "draft" : "pending",
      requesterId: CURRENT_USER_ID,
      ownerId: input.ownerId,
      department: input.department,
      project: input.project,
      relatedTaskRef: input.relatedTaskRef ?? null,
      tags: input.tags,
      attachments: [],
      createdAt: at,
      updatedAt: at,
      dueAt: input.dueAt ?? null,
      comments: [],
      activity: [
        { id: `ac-${id}-1`, kind: "created", actorId: CURRENT_USER_ID, at },
        ...(input.ownerId
          ? [
              {
                id: `ac-${id}-2`,
                kind: "assigned" as const,
                actorId: CURRENT_USER_ID,
                at,
                meta: { to: input.ownerId },
              },
            ]
          : []),
      ],
    };
    items = [dep, ...items];
    emit();
    return dep;
  },
  setState(id: string, state: DependencyState) {
    items = items.map((d) => {
      if (d.id !== id) return d;
      const at = nowIso();
      const activity = [
        ...d.activity,
        {
          id: `ac-${id}-${d.activity.length + 1}`,
          kind:
            state === "resolved"
              ? ("resolved" as const)
              : state === "closed"
                ? ("closed" as const)
                : state === "rejected"
                  ? ("rejected" as const)
                  : state === "cancelled"
                    ? ("cancelled" as const)
                    : state === "accepted"
                      ? ("accepted" as const)
                      : ("status_changed" as const),
          actorId: CURRENT_USER_ID,
          at,
          meta: { from: d.state, to: state },
        },
      ];
      return {
        ...d,
        state,
        updatedAt: at,
        resolvedAt: state === "resolved" || state === "closed" ? at : d.resolvedAt,
        activity,
      };
    });
    emit();
  },
  setPriority(id: string, priority: DependencyPriority) {
    items = items.map((d) =>
      d.id === id
        ? {
            ...d,
            priority,
            updatedAt: nowIso(),
            activity: [
              ...d.activity,
              {
                id: `ac-${id}-${d.activity.length + 1}`,
                kind: "priority_changed",
                actorId: CURRENT_USER_ID,
                at: nowIso(),
                meta: { from: d.priority, to: priority },
              },
            ],
          }
        : d,
    );
    emit();
  },
  addComment(id: string, body: string, parentId?: string | null) {
    const at = nowIso();
    const mentions = Array.from(body.matchAll(/@([\w-]+)/g)).map((m) => m[1]);
    const comment: DependencyComment = {
      id: `c-${id}-${at}`,
      authorId: CURRENT_USER_ID,
      body,
      createdAt: at,
      parentId: parentId ?? null,
      mentions,
    };
    items = items.map((d) =>
      d.id === id
        ? {
            ...d,
            comments: [...d.comments, comment],
            updatedAt: at,
            activity: [
              ...d.activity,
              {
                id: `ac-${id}-${d.activity.length + 1}`,
                kind: "comment_added",
                actorId: CURRENT_USER_ID,
                at,
              },
            ],
          }
        : d,
    );
    emit();
  },
};

export function useDependencies(): Dependency[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}

export function useDependency(id: string): Dependency | undefined {
  const all = useDependencies();
  return all.find((d) => d.id === id);
}

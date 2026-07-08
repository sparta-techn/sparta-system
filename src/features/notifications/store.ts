/**
 * Notification store. Supabase-backed: an in-memory cache is hydrated from the
 * `notifications` table (scoped to the signed-in user by RLS) and kept live via
 * a Realtime subscription. Mutations are optimistic + written through to
 * Supabase. The React surface (`useNotifications`, `useUnreadCount`,
 * `useMinuteTick`) and the `notificationStore.*` API are unchanged — swapping
 * the backend touched only `read`/`write` and the mutation internals.
 */

import { useEffect, useSyncExternalStore } from "react";

import { notificationRepository } from "@/repositories/notifications";
import { subscribeToTable } from "@/lib/supabase/realtime";

import { archiveState, deleteState, markReadState, markUnreadState } from "./collaboration-rules";
import { notificationRowToApp } from "./mappers";
import type { AppNotification, NotificationLifecycle } from "./types";

const listeners = new Set<() => void>();

/** Current user's notifications (newest-first is applied on read). */
let cache: AppNotification[] = [];
/** The signed-in user this cache belongs to. */
let currentUserId: string | null = null;
/** Live Realtime subscription teardown for the current user. */
let realtimeUnsub: (() => void) | null = null;

/**
 * Memoized derived views. `useSyncExternalStore` requires `getSnapshot` to
 * return a *stable* reference between changes; a fresh `.filter().sort()` array
 * on every call makes React 19 re-render in an infinite loop ("getSnapshot
 * should be cached"). These caches are cleared on every {@link write}, so each
 * getSnapshot returns the same array until the store actually mutates.
 */
let listMemo: AppNotification[] | null = null;
const listForMemo = new Map<string, AppNotification[]>();
/** Shared stable empty array for the "no user" snapshot. */
const EMPTY_LIST: AppNotification[] = [];

function read(): AppNotification[] {
  return cache;
}

function write(next: AppNotification[]) {
  cache = next;
  listMemo = null;
  listForMemo.clear();
  listeners.forEach((l) => l());
}

function nowIso() {
  return new Date().toISOString();
}

/** Fetch the current user's inbox from Supabase into the cache. */
async function hydrate() {
  const userId = currentUserId;
  if (!userId) {
    write([]);
    return;
  }
  try {
    const rows = await notificationRepository.inbox(userId);
    // Ignore a response that arrived after the user changed.
    if (currentUserId !== userId) return;
    write(rows.map(notificationRowToApp));
  } catch {
    /* keep the last good cache on transient failures */
  }
}

/**
 * Point the store at a user (from auth). Clears + re-hydrates and (re)binds the
 * Realtime subscription so new/updated notifications stream in. Pass `null` on
 * sign-out.
 */
export function setNotificationUser(userId: string | null) {
  if (userId === currentUserId) return;
  currentUserId = userId;

  realtimeUnsub?.();
  realtimeUnsub = null;
  write([]);

  if (!userId) return;

  void hydrate();
  realtimeUnsub = subscribeToTable({
    table: "notifications",
    filter: `recipient_id=eq.${userId}`,
    onChange: () => void hydrate(),
    onResync: () => void hydrate(),
  });
}

export function getNotificationUserId(): string | null {
  return currentUserId;
}

export const notificationStore = {
  list(): AppNotification[] {
    // Newest first, excluding deleted. Memoized until the next write().
    if (listMemo === null) {
      listMemo = read()
        .filter((n) => !n.deletedAt)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return listMemo;
  },
  listFor(userId: string): AppNotification[] {
    const cached = listForMemo.get(userId);
    if (cached) return cached;
    const derived = notificationStore.list().filter((n) => n.recipientId === userId);
    listForMemo.set(userId, derived);
    return derived;
  },
  unreadCount(userId: string): number {
    return notificationStore.listFor(userId).filter((n) => !n.readAt && !n.archivedAt).length;
  },
  add(notification: AppNotification) {
    write([notification, ...read().filter((n) => n.id !== notification.id)]);
  },
  addMany(items: AppNotification[]) {
    if (!items.length) return;
    const existingIds = new Set(read().map((n) => n.id));
    const fresh = items.filter((n) => !existingIds.has(n.id));
    if (!fresh.length) return;
    write([...fresh, ...read()]);
  },
  markRead(id: string) {
    write(read().map((n) => (n.id === id ? markReadState(n) : n)));
    void notificationRepository.markRead(id).catch(() => void hydrate());
  },
  markUnread(id: string) {
    write(read().map((n) => (n.id === id ? markUnreadState(n) : n)));
    void notificationRepository.markUnread(id).catch(() => void hydrate());
  },
  markAllRead(userId: string) {
    const at = nowIso();
    write(read().map((n) => (n.recipientId === userId && !n.readAt ? markReadState(n, at) : n)));
    void notificationRepository.markAllRead(userId).catch(() => void hydrate());
  },
  archive(id: string) {
    write(read().map((n) => (n.id === id ? archiveState(n) : n)));
    void notificationRepository.archive(id).catch(() => void hydrate());
  },
  unarchive(id: string) {
    write(read().map((n) => (n.id === id ? { ...n, archivedAt: null } : n)));
    // No dedicated "unarchive"; restore to read state.
    void notificationRepository.markRead(id).catch(() => void hydrate());
  },
  remove(id: string) {
    write(read().map((n) => (n.id === id ? deleteState(n) : n)));
    void notificationRepository.dismiss(id).catch(() => void hydrate());
  },
  clear() {
    write([]);
  },
  /** Pure helper used by the lifecycle column in dev tooling. */
  lifecycleOf(n: AppNotification): NotificationLifecycle {
    if (n.deletedAt) return "deleted";
    if (n.expiresAt && n.expiresAt < nowIso()) return "expired";
    if (n.archivedAt) return "archived";
    if (n.readAt) return "read";
    return "delivered";
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useNotifications(userId: string | null | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? notificationStore.listFor(userId) : EMPTY_LIST),
    () => EMPTY_LIST,
  );
}

export function useUnreadCount(userId: string | null | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? notificationStore.unreadCount(userId) : 0),
    () => 0,
  );
}

/** Re-render every 60s so relative timestamps refresh. */
export function useMinuteTick() {
  useSyncExternalStore(
    (l) => {
      const id = window.setInterval(l, 60_000);
      return () => window.clearInterval(id);
    },
    () => Math.floor(Date.now() / 60_000),
    () => 0,
  );
}

// Re-export to make hook + store importable from one module
export { useEffect };

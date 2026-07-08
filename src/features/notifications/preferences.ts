/**
 * User preference store. Supabase-backed: an in-memory cache is hydrated from
 * the `notification_preferences` table (one row per user, scoped by RLS to
 * `user_id = auth.uid()`) and written through on every change. Mirrors the
 * inbox `store.ts` — bind the user with {@link setPreferencesUser} (done in
 * `bootstrap.ts`), then reads are synchronous from cache and mutations are
 * optimistic + persisted.
 *
 * The automation engine consults `getPreferences()` per recipient before
 * dispatching. Disabled categories suppress in-app notifications; quiet
 * hours suppress non-critical ones.
 */

import { useSyncExternalStore } from "react";

import { notificationPreferenceRepository } from "@/repositories/notifications";
import type {
  NotificationPreferencesRow,
  NotificationPreferencesUpsert,
} from "@/services/notifications";

import type { DeliveryChannel, NotificationPreferences, PreferenceCategory } from "./types";

const listeners = new Set<() => void>();
let cache: NotificationPreferences | null = null;
/** The signed-in user this cache belongs to (null when signed out). */
let currentUserId: string | null = null;

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  categories: {
    attendance: true,
    dependencies: true,
    announcements: true,
    reports: true,
    mentions: true,
    system: true,
    tasks: true,
    approvals: true,
  },
  channels: {
    in_app: true,
    email: false,
    slack: false,
    teams: false,
    telegram: false,
    whatsapp: false,
    push: false,
    sms: false,
  },
  quietHours: { start: "22:00", end: "07:00", enabled: false },
};

// ── Row ↔ client mapping (snake_case row ↔ camelCase `quietHours`) ────────────

function rowToPreferences(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    categories: {
      ...DEFAULT_PREFERENCES.categories,
      ...(row.categories as Partial<Record<PreferenceCategory, boolean>>),
    },
    channels: {
      ...DEFAULT_PREFERENCES.channels,
      ...(row.channels as Partial<Record<DeliveryChannel, boolean>>),
    },
    quietHours: {
      start: row.quiet_hours?.start ?? DEFAULT_PREFERENCES.quietHours!.start,
      end: row.quiet_hours?.end ?? DEFAULT_PREFERENCES.quietHours!.end,
      enabled: !!row.quiet_hours?.enabled,
    },
  };
}

function toUpsert(userId: string, prefs: NotificationPreferences): NotificationPreferencesUpsert {
  return {
    user_id: userId,
    categories: prefs.categories,
    channels: prefs.channels,
    quiet_hours: prefs.quietHours ?? { enabled: false },
  };
}

// ── Cache + persistence ──────────────────────────────────────────────────────

function read(): NotificationPreferences {
  return cache ?? DEFAULT_PREFERENCES;
}

/** Update the in-memory cache and notify subscribers (no persistence). */
function writeLocal(next: NotificationPreferences) {
  cache = next;
  listeners.forEach((l) => l());
}

/** Optimistically apply `next`, then write it through to Supabase. */
function commit(next: NotificationPreferences) {
  writeLocal(next);
  const userId = currentUserId;
  if (!userId) return; // e.g. tests / signed-out: cache-only, no round trip
  void notificationPreferenceRepository.save(toUpsert(userId, next)).catch(() => void hydrate());
}

/** Fetch the bound user's preferences into the cache (defaults if none saved). */
async function hydrate() {
  const userId = currentUserId;
  if (!userId) {
    writeLocal(DEFAULT_PREFERENCES);
    return;
  }
  try {
    const row = await notificationPreferenceRepository.get(userId);
    if (currentUserId !== userId) return; // a newer user won the race
    writeLocal(row ? rowToPreferences(row) : DEFAULT_PREFERENCES);
  } catch {
    /* keep the last good cache on transient failures */
  }
}

/**
 * Point the store at a user (from auth). Resets to defaults and re-hydrates from
 * `notification_preferences`. Pass `null` on sign-out. Called from `bootstrap.ts`
 * alongside `setNotificationUser`.
 */
export function setPreferencesUser(userId: string | null) {
  if (userId === currentUserId) return;
  currentUserId = userId;
  cache = null;
  if (!userId) {
    writeLocal(DEFAULT_PREFERENCES);
    return;
  }
  void hydrate();
}

export function getPreferencesUserId(): string | null {
  return currentUserId;
}

export const preferences = {
  get: read,
  setCategory(cat: PreferenceCategory, enabled: boolean) {
    const cur = read();
    commit({ ...cur, categories: { ...cur.categories, [cat]: enabled } });
  },
  setChannel(channel: DeliveryChannel, enabled: boolean) {
    const cur = read();
    commit({ ...cur, channels: { ...cur.channels, [channel]: enabled } });
  },
  setQuietHours(next: NotificationPreferences["quietHours"]) {
    commit({ ...read(), quietHours: next });
  },
  reset() {
    commit(DEFAULT_PREFERENCES);
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePreferences(): NotificationPreferences {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_PREFERENCES);
}

export function isInQuietHours(prefs: NotificationPreferences, at = new Date()): boolean {
  if (!prefs.quietHours?.enabled) return false;
  const { start, end } = prefs.quietHours;
  const cur = at.getHours() * 60 + at.getMinutes();
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const a = toMin(start);
  const b = toMin(end);
  return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
}

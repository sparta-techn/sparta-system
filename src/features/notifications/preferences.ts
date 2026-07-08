/**
 * User preference store. LocalStorage-backed mock.
 *
 * The automation engine consults `getPreferences()` per recipient before
 * dispatching. Disabled categories suppress in-app notifications; quiet
 * hours suppress non-critical ones.
 */

import { useSyncExternalStore } from "react";

import type { DeliveryChannel, NotificationPreferences, PreferenceCategory } from "./types";

const KEY = "sf:notifications:prefs:v1";
const listeners = new Set<() => void>();
let cache: NotificationPreferences | null = null;

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

function read(): NotificationPreferences {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    cache = DEFAULT_PREFERENCES;
  }
  return cache!;
}

function write(next: NotificationPreferences) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export const preferences = {
  get: read,
  setCategory(cat: PreferenceCategory, enabled: boolean) {
    const cur = read();
    write({ ...cur, categories: { ...cur.categories, [cat]: enabled } });
  },
  setChannel(channel: DeliveryChannel, enabled: boolean) {
    const cur = read();
    write({ ...cur, channels: { ...cur.channels, [channel]: enabled } });
  },
  setQuietHours(next: NotificationPreferences["quietHours"]) {
    write({ ...read(), quietHours: next });
  },
  reset() {
    write(DEFAULT_PREFERENCES);
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

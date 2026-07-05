/**
 * System store — localStorage-backed, reactive. Backs the Admin Console's
 * System Settings, Feature Flags, and Maintenance Mode. Every mutation records
 * a `settings_changed` audit event (see `features/audit`) so platform changes
 * are traceable. Mirrors a future `system_settings` / `feature_flags` surface.
 */
import { useSyncExternalStore } from "react";

import { recordAudit } from "@/features/audit/audit-store";
import type { FeatureFlag, MaintenanceState, SystemSettings, SystemState } from "./types";

const KEY = "spartaflow:admin:system:v1";

const DEFAULT_SETTINGS: SystemSettings = {
  companyName: "SpartaFlow",
  supportEmail: "support@spartaflow.dev",
  defaultTimezone: "UTC",
  sessionTimeoutMinutes: 60,
  allowSignups: false,
  enforce2fa: false,
};

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    key: "ai_assistant",
    label: "AI Assistant",
    description: "In-app AI chat and review.",
    enabled: true,
  },
  {
    key: "sprint_planning",
    label: "Sprint planning",
    description: "Sprint boards and planning tools.",
    enabled: true,
  },
  {
    key: "time_tracking",
    label: "Time tracking",
    description: "Timers and time entries.",
    enabled: true,
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "External-system connectors.",
    enabled: true,
  },
  {
    key: "executive_dashboard",
    label: "Executive dashboard",
    description: "Owner cockpit and alerts.",
    enabled: true,
  },
  { key: "kanban_v2", label: "Kanban v2", description: "Redesigned board (beta).", enabled: false },
];

const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  message: "SpartaFlow is undergoing scheduled maintenance. We'll be back shortly.",
  startedAt: null,
  plannedEndAt: null,
};

export const TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/Berlin",
  "Europe/Lisbon",
  "America/Toronto",
  "America/Buenos_Aires",
  "Asia/Tokyo",
  "Africa/Cairo",
  "Asia/Kolkata",
] as const;

function defaultState(): SystemState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    flags: DEFAULT_FLAGS.map((f) => ({ ...f })),
    maintenance: { ...DEFAULT_MAINTENANCE },
  };
}

function load(): SystemState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<SystemState>;
    const base = defaultState();
    // Merge flags by key so new default flags survive an older payload.
    const flags = base.flags.map((f) => {
      const saved = parsed.flags?.find((s) => s.key === f.key);
      return saved ? { ...f, enabled: saved.enabled } : f;
    });
    return {
      settings: { ...base.settings, ...parsed.settings },
      flags,
      maintenance: { ...base.maintenance, ...parsed.maintenance },
    };
  } catch {
    return defaultState();
  }
}

let state: SystemState = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- reads ----------

export function getSystemState(): SystemState {
  return state;
}

export function getSettings(): SystemSettings {
  return state.settings;
}

export function getFlags(): FeatureFlag[] {
  return state.flags;
}

export function getMaintenance(): MaintenanceState {
  return state.maintenance;
}

/** True when a feature flag is enabled (unknown keys default to `true`). */
export function isFeatureEnabled(key: string): boolean {
  const flag = state.flags.find((f) => f.key === key);
  return flag ? flag.enabled : true;
}

export function useSystemSettings(): SystemSettings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}

export function useFeatureFlags(): FeatureFlag[] {
  return useSyncExternalStore(subscribe, getFlags, () => DEFAULT_FLAGS);
}

export function useMaintenance(): MaintenanceState {
  return useSyncExternalStore(subscribe, getMaintenance, () => DEFAULT_MAINTENANCE);
}

// ---------- writes ----------

const SETTING_LABEL: Record<keyof SystemSettings, string> = {
  companyName: "Company name",
  supportEmail: "Support email",
  defaultTimezone: "Default timezone",
  sessionTimeoutMinutes: "Session timeout",
  allowSignups: "Allow signups",
  enforce2fa: "Enforce 2FA",
};

/** Patch system settings; audits each changed field with its old→new value. */
export function updateSettings(patch: Partial<SystemSettings>): SystemSettings {
  const prev = state.settings;
  const next = { ...prev, ...patch };
  state = { ...state, settings: next };
  for (const key of Object.keys(patch) as (keyof SystemSettings)[]) {
    if (prev[key] !== next[key]) {
      recordAudit({
        action: "settings_changed",
        target: SETTING_LABEL[key],
        targetType: "settings",
        oldValue: String(prev[key]),
        newValue: String(next[key]),
      });
    }
  }
  emit();
  return next;
}

/** Toggle (or set) a feature flag; audits the change. */
export function setFeatureFlag(key: string, enabled: boolean): void {
  const flag = state.flags.find((f) => f.key === key);
  if (!flag || flag.enabled === enabled) return;
  state = {
    ...state,
    flags: state.flags.map((f) => (f.key === key ? { ...f, enabled } : f)),
  };
  recordAudit({
    action: "settings_changed",
    target: `Feature flag: ${flag.label}`,
    targetType: "feature_flag",
    oldValue: flag.enabled ? "on" : "off",
    newValue: enabled ? "on" : "off",
  });
  emit();
}

/** Enable/disable maintenance mode; stamps `startedAt` and audits. */
export function setMaintenance(patch: Partial<MaintenanceState>): MaintenanceState {
  const prev = state.maintenance;
  const next: MaintenanceState = { ...prev, ...patch };
  if (patch.enabled !== undefined && patch.enabled !== prev.enabled) {
    next.startedAt = patch.enabled ? new Date().toISOString() : null;
    recordAudit({
      action: "settings_changed",
      target: "Maintenance mode",
      targetType: "maintenance",
      oldValue: prev.enabled ? "on" : "off",
      newValue: patch.enabled ? "on" : "off",
    });
  }
  state = { ...state, maintenance: next };
  emit();
  return next;
}

/** Test/support helper — reset to defaults. */
export function __resetSystem(): void {
  state = defaultState();
  emit();
}

/**
 * AI settings store — localStorage-backed reactive facade for **non-secret**
 * provider configuration. API keys are NOT stored here (see `secure-store.ts`).
 *
 * Mirrors the future `ai_provider_config` surface (`docs/AI_ARCHITECTURE.md`), so
 * this can be swapped for server persistence without touching components.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/features/audit/audit-store";
import { CONFIGURABLE_PROVIDERS, defaultConfig } from "./provider-meta";
import type { AISettingsState, ConfigurableProviderId, ProviderConfig } from "./types";

const STORAGE_KEY = "spartaflow:ai-settings:v1";

function defaultState(): AISettingsState {
  return {
    activeProvider: "anthropic",
    configs: {
      openai: defaultConfig("openai"),
      anthropic: defaultConfig("anthropic"),
      gemini: defaultConfig("gemini"),
    },
  };
}

function load(): AISettingsState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AISettingsState>;
    const base = defaultState();
    // Merge defensively so new fields/providers survive an older payload.
    const configs = { ...base.configs };
    for (const p of CONFIGURABLE_PROVIDERS) {
      configs[p] = { ...base.configs[p], ...parsed.configs?.[p], provider: p };
    }
    return { activeProvider: parsed.activeProvider ?? base.activeProvider, configs };
  } catch {
    return defaultState();
  }
}

let state: AISettingsState = load();
const listeners = new Set<() => void>();

function set(next: AISettingsState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota — ignore */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAISettingsState<T>(selector: (s: AISettingsState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(defaultState()),
  );
}

// ── reads ────────────────────────────────────────────────────────────────────

export function getConfig(provider: ConfigurableProviderId): ProviderConfig {
  return state.configs[provider];
}

export function getActiveProvider(): ConfigurableProviderId {
  return state.activeProvider;
}

// ── mutations ────────────────────────────────────────────────────────────────

export function setActiveProvider(provider: ConfigurableProviderId): void {
  const prev = state.activeProvider;
  set({ ...state, activeProvider: provider });
  if (provider !== prev) {
    recordAudit({
      action: "settings_changed",
      target: "AI provider",
      targetType: "settings",
      oldValue: prev,
      newValue: provider,
    });
  }
}

export function saveConfig(provider: ConfigurableProviderId, patch: Partial<ProviderConfig>): void {
  set({
    ...state,
    configs: {
      ...state.configs,
      [provider]: { ...state.configs[provider], ...patch, provider },
    },
  });
}

export function resetConfig(provider: ConfigurableProviderId): void {
  saveConfig(provider, defaultConfig(provider));
}

/**
 * Secure(-ish) local secret store for provider API keys.
 *
 * Keys are kept **separate** from the non-secret settings store, obfuscated at
 * rest, and **never rendered back to the UI** — the UI only ever sees a masked
 * preview (`sk-…a1b2`) and a boolean "is set". `getApiKey` returns the real key
 * only for programmatic use (a future provider adapter).
 *
 * ⚠️ Honest limitation: browser `localStorage` is **not** a real secret store and
 * the obfuscation below is not cryptography — it only deters casual inspection.
 * For production, keys belong in server-side Edge Function secrets (see
 * `docs/AI_ARCHITECTURE.md`); this module is the local-dev stand-in.
 */

import { useSyncExternalStore } from "react";
import type { ConfigurableProviderId, SecretStatus } from "./types";

const STORAGE_KEY = "spartaflow:ai-secrets:v1";
// Not a cryptographic secret — only used to avoid storing keys in plaintext.
const OBFUSCATION_PAD = "spartaflow-ai-local";

type SecretMap = Partial<Record<ConfigurableProviderId, string>>; // values are obfuscated

function xorCipher(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(
      input.charCodeAt(i) ^ OBFUSCATION_PAD.charCodeAt(i % OBFUSCATION_PAD.length),
    );
  }
  return out;
}

function obfuscate(raw: string): string {
  if (typeof window === "undefined") return raw;
  return window.btoa(unescape(encodeURIComponent(xorCipher(raw))));
}

function deobfuscate(encoded: string): string {
  if (typeof window === "undefined") return "";
  try {
    return xorCipher(decodeURIComponent(escape(window.atob(encoded))));
  } catch {
    return "";
  }
}

function loadMap(): SecretMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SecretMap;
  } catch {
    return {};
  }
}

let secrets: SecretMap = loadMap();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(secrets));
  } catch {
    /* quota — ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

// ── secret access ────────────────────────────────────────────────────────────

/** Store (or replace) a provider's API key. */
export function setApiKey(provider: ConfigurableProviderId, key: string): void {
  secrets = { ...secrets, [provider]: obfuscate(key.trim()) };
  emit();
}

/** Remove a provider's API key. */
export function clearApiKey(provider: ConfigurableProviderId): void {
  const next = { ...secrets };
  delete next[provider];
  secrets = next;
  emit();
}

/** Internal: deobfuscate the stored key. Used only for masked previews/status. */
function readRawKey(provider: ConfigurableProviderId): string | null {
  const enc = secrets[provider];
  if (!enc) return null;
  const key = deobfuscate(enc);
  return key || null;
}

let warnedProdRead = false;

/**
 * The real key — for programmatic use only (never render this).
 *
 * SECURITY: in production builds this **always returns `null`**. Third-party API
 * keys must never be held or used client-side in prod (browser `localStorage` is
 * XSS-readable); the provider adapters must call through an authenticated server
 * function that reads the key from a server-side secret. This guard makes the
 * unsafe path impossible to hit in prod even after providers are wired. See
 * `docs/SECURITY.md` → "Secure storage".
 */
export function getApiKey(provider: ConfigurableProviderId): string | null {
  if (import.meta.env.PROD) {
    if (!warnedProdRead) {
      warnedProdRead = true;
      console.warn(
        "[secure-store] Refusing to expose an API key to client code in production. " +
          "Route AI calls through a server function backed by a server-side secret.",
      );
    }
    return null;
  }
  return readRawKey(provider);
}

/** Whether a key is stored for a provider. */
export function hasApiKey(provider: ConfigurableProviderId): boolean {
  return Boolean(secrets[provider]);
}

/** A masked preview safe to display, e.g. `sk-…a1b2`. Never the full key. */
export function maskApiKey(provider: ConfigurableProviderId): string | null {
  // Uses the internal reader so previews keep working in production, where
  // `getApiKey` intentionally returns null.
  const key = readRawKey(provider);
  if (!key) return null;
  const last4 = key.slice(-4);
  const prefix = key.startsWith("sk-ant-")
    ? "sk-ant-"
    : key.startsWith("sk-")
      ? "sk-"
      : key.slice(0, 4);
  return `${prefix}…${last4}`;
}

// ── reactive status (never exposes the key) ──────────────────────────────────

function statusSnapshot(): Record<ConfigurableProviderId, SecretStatus> {
  const build = (p: ConfigurableProviderId): SecretStatus => ({
    set: hasApiKey(p),
    preview: maskApiKey(p),
  });
  return { openai: build("openai"), anthropic: build("anthropic"), gemini: build("gemini") };
}

let cachedSnapshot = statusSnapshot();

function subscribe(l: () => void): () => void {
  const wrapped = () => {
    cachedSnapshot = statusSnapshot();
    l();
  };
  listeners.add(wrapped);
  return () => listeners.delete(wrapped);
}

const emptySnapshot: Record<ConfigurableProviderId, SecretStatus> = {
  openai: { set: false, preview: null },
  anthropic: { set: false, preview: null },
  gemini: { set: false, preview: null },
};

/** Reactive per-provider secret status (masked previews + booleans only). */
export function useSecretStatus(): Record<ConfigurableProviderId, SecretStatus> {
  return useSyncExternalStore(
    subscribe,
    () => cachedSnapshot,
    () => emptySnapshot,
  );
}

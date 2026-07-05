/**
 * Provider display + validation metadata. Model lists and limits are reused from
 * the AI model catalog (`@/ai`) — this file owns only the presentation and
 * key-format details specific to the settings UI.
 */

import { MODEL_CATALOG, defaultModelFor } from "@/ai/models";
import type { AIModelDescriptor } from "@/ai/types";
import type { ConfigurableProviderId, ProviderConfig } from "./types";

export interface ProviderMeta {
  id: ConfigurableProviderId;
  label: string;
  /** Human hint about the key format. */
  keyHint: string;
  /** Loose validation pattern for the key. */
  keyPattern: RegExp;
  keyPlaceholder: string;
  /** Where to obtain a key. */
  docsUrl: string;
  /** Highest temperature the provider accepts. */
  maxTemperature: number;
}

export const PROVIDER_META: Record<ConfigurableProviderId, ProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    keyHint: "Starts with “sk-”.",
    keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    keyPlaceholder: "sk-…",
    docsUrl: "https://platform.openai.com/api-keys",
    maxTemperature: 2,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    keyHint: "Starts with “sk-ant-”.",
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    keyPlaceholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
    maxTemperature: 1,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    keyHint: "Starts with “AIza”.",
    keyPattern: /^AIza[A-Za-z0-9_-]{30,}$/,
    keyPlaceholder: "AIza…",
    docsUrl: "https://aistudio.google.com/app/apikey",
    maxTemperature: 2,
  },
};

/** The providers configurable here, in display order. */
export const CONFIGURABLE_PROVIDERS: ConfigurableProviderId[] = ["openai", "anthropic", "gemini"];

/** Models a provider exposes (from the shared catalog). */
export function modelsFor(provider: ConfigurableProviderId): readonly AIModelDescriptor[] {
  return MODEL_CATALOG[provider];
}

/** A sensible default configuration for a provider. */
export function defaultConfig(provider: ConfigurableProviderId): ProviderConfig {
  const model = defaultModelFor(provider);
  const modelId = model?.id ?? modelsFor(provider)[0]?.id ?? "";
  const cap = model?.maxOutputTokens ?? 2048;
  return {
    provider,
    model: modelId,
    temperature: 0.3,
    maxTokens: Math.min(2048, cap),
    systemPrompt: "",
  };
}

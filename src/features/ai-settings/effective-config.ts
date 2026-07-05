/**
 * The effective provider configuration — the bridge between the settings UI and
 * the AI engine. When a real provider adapter is wired, the engine reads the
 * active provider's config + key from here.
 *
 * NOTE: this returns the real API key, so it is a **non-UI** module. Never call
 * it from a component render path that could surface the value.
 */

import { getActiveProvider, getConfig } from "./store";
import { getApiKey } from "./secure-store";
import type { ConfigurableProviderId, ProviderConfig } from "./types";

export interface EffectiveProviderConfig extends ProviderConfig {
  provider: ConfigurableProviderId;
  /** True when an API key is configured for the provider. */
  hasApiKey: boolean;
  /** The API key, if set — for programmatic provider calls only. */
  apiKey: string | null;
}

/** Resolve the effective config for the active (or a specific) provider. */
export function getEffectiveConfig(
  provider: ConfigurableProviderId = getActiveProvider(),
): EffectiveProviderConfig {
  const config = getConfig(provider);
  const apiKey = getApiKey(provider);
  return { ...config, hasApiKey: Boolean(apiKey), apiKey };
}

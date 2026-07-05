/**
 * Provider registry — resolves an {@link AIProviderId} to a concrete adapter.
 *
 * Adding a provider = one factory entry here + one adapter file. Nothing above
 * this module names a vendor. Instances are memoized so a provider is
 * constructed at most once per process.
 */

import type { AIProvider, AIProviderId } from "../types";
import { AIError } from "../utils/errors";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAIProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";
import { MockProvider } from "./mock-provider";

/** Factories keyed by provider id. `local` is reserved for a future adapter. */
const factories: Partial<Record<AIProviderId, () => AIProvider>> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
  gemini: () => new GeminiProvider(),
  mock: () => new MockProvider(),
};

/** The default provider when none is configured. */
export const DEFAULT_PROVIDER_ID: AIProviderId = "anthropic";

const instances = new Map<AIProviderId, AIProvider>();

/** Resolve a provider adapter, memoizing the instance. */
export function getProvider(id: AIProviderId = DEFAULT_PROVIDER_ID): AIProvider {
  const cached = instances.get(id);
  if (cached) return cached;

  const make = factories[id];
  if (!make) {
    throw new AIError("unknown_provider", `No adapter registered for provider "${id}".`);
  }

  const provider = make();
  instances.set(id, provider);
  return provider;
}

/** Provider ids that currently have a registered adapter. */
export function registeredProviders(): AIProviderId[] {
  return Object.keys(factories) as AIProviderId[];
}

/** Test/reset seam — clears memoized instances. */
export function resetProviders(): void {
  instances.clear();
}

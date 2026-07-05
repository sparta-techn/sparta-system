/**
 * IntegrationRegistry — resolves an {@link IntegrationId} to a memoized adapter.
 *
 * The composition root for provider instances: it constructs each adapter at
 * most once (via {@link ProviderFactory}) and hands the same instance back on
 * subsequent lookups. Mirrors the memoized `getProvider` + `resetProviders`
 * pattern in `src/ai/providers/registry.ts`. Callers above this layer never name
 * a concrete adapter class.
 */

import type { Integration, IntegrationId, IntegrationMetadata } from "../types";
import type { AccountStore } from "../services/account-store";
import { ProviderFactory } from "./provider-factory";

export class IntegrationRegistry {
  private readonly instances = new Map<IntegrationId, Integration>();

  constructor(
    private readonly factory: ProviderFactory,
    private readonly store: AccountStore,
  ) {}

  /** True when an adapter is registered for `id`. */
  has(id: IntegrationId): boolean {
    return this.factory.has(id);
  }

  /** Every registered provider id. */
  ids(): IntegrationId[] {
    return this.factory.knownIds();
  }

  /** Static metadata for all providers (no adapter construction). */
  catalog(): IntegrationMetadata[] {
    return this.factory.allMetadata();
  }

  /** Resolve an adapter, memoizing the instance. */
  get(id: IntegrationId): Integration {
    const cached = this.instances.get(id);
    if (cached) return cached;
    const instance = this.factory.create(id, this.store);
    this.instances.set(id, instance);
    return instance;
  }

  /** All registered adapters, constructed + memoized. */
  all(): Integration[] {
    return this.ids().map((id) => this.get(id));
  }

  /**
   * Resolve the first *available* provider that advertises a capability. Lets
   * features depend on a capability instead of a vendor id (e.g. "chat.notify").
   */
  firstWithCapability(capability: IntegrationMetadata["capabilities"][number]): Integration | null {
    for (const meta of this.catalog()) {
      if (meta.available && meta.capabilities.includes(capability)) {
        return this.get(meta.id);
      }
    }
    return null;
  }

  /** Test/reset seam — clears memoized instances (mirrors `resetProviders`). */
  reset(): void {
    this.instances.clear();
  }
}

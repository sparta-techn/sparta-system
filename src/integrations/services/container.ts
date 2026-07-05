/**
 * Composition root — wires the platform's singletons together.
 *
 * One place assembles the store → factory → registry → settings → manager graph,
 * memoized per process so the whole app shares one manager (and therefore one
 * reactive status surface). Swapping {@link InMemoryAccountStore} for a Supabase-
 * backed store later is a single change here; nothing else moves.
 */

import { ProviderFactory } from "../providers/provider-factory";
import { IntegrationRegistry } from "../providers/integration-registry";
import { InMemoryAccountStore, type AccountStore } from "./account-store";
import { SettingsManager } from "./settings-manager";
import { IntegrationManager } from "./integration-manager";
import { MockTelemetryService } from "./mock-telemetry";

interface Container {
  store: AccountStore;
  factory: ProviderFactory;
  registry: IntegrationRegistry;
  settings: SettingsManager;
  manager: IntegrationManager;
  telemetry: MockTelemetryService;
}

let container: Container | null = null;

function build(): Container {
  const store = new InMemoryAccountStore();
  const factory = new ProviderFactory();
  const registry = new IntegrationRegistry(factory, store);
  const settings = new SettingsManager(registry, store);
  const manager = new IntegrationManager(registry, store, settings);
  // Local, offline telemetry source for the Integration Center (no API calls).
  const telemetry = new MockTelemetryService(registry.ids());
  return { store, factory, registry, settings, manager, telemetry };
}

function get(): Container {
  if (!container) container = build();
  return container;
}

/** The shared, process-wide {@link IntegrationManager}. */
export function getIntegrationManager(): IntegrationManager {
  return get().manager;
}

/** The shared {@link IntegrationRegistry}. */
export function getIntegrationRegistry(): IntegrationRegistry {
  return get().registry;
}

/** The shared {@link SettingsManager}. */
export function getSettingsManager(): SettingsManager {
  return get().settings;
}

/** The shared, offline {@link MockTelemetryService} powering the Integration Center. */
export function getTelemetryService(): MockTelemetryService {
  return get().telemetry;
}

/** Test/reset seam — rebuilds the container from scratch. */
export function resetIntegrationContainer(): void {
  container = null;
}

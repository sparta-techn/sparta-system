/** Orchestration services + the composition root for the Integration Platform. */

export { IntegrationError, notImplemented } from "./errors";
export type { IntegrationErrorCode, IntegrationErrorDetail } from "./errors";

export { InMemoryAccountStore } from "./account-store";
export type { AccountStore } from "./account-store";

export { SettingsManager } from "./settings-manager";
export { IntegrationManager } from "./integration-manager";

export { MockTelemetryService } from "./mock-telemetry";
export type {
  IntegrationTelemetry,
  HealthSample,
  LastSyncInfo,
  TelemetryError,
  LogEntry,
  LogLevel,
} from "./mock-telemetry";

export {
  getIntegrationManager,
  getIntegrationRegistry,
  getSettingsManager,
  getTelemetryService,
  resetIntegrationContainer,
} from "./container";

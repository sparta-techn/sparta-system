/**
 * ProviderStatus — the runtime status value object for one provider.
 *
 * Wraps the raw {@link ProviderStatusState} with derivation helpers, display
 * metadata and a serializable snapshot, so the manager, hooks and UI all read
 * status through one type instead of juggling loose fields. Immutable: every
 * transition returns a new instance.
 */

import type { HealthState, IntegrationId, ProviderStatusState } from "../types";
import type { HealthStatus } from "../types";

/** A plain, JSON-serializable snapshot of a {@link ProviderStatus}. */
export interface ProviderStatusSnapshot {
  integrationId: IntegrationId;
  state: ProviderStatusState;
  connected: boolean;
  /** Number of connected accounts for this provider. */
  accountCount: number;
  lastCheckedAt: string | null;
  latencyMs: number | null;
  message: string | null;
}

/** UI tone for a status, mapping to Badge variants / colors. */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "muted";

const STATE_TONE: Record<ProviderStatusState, StatusTone> = {
  disconnected: "neutral",
  connecting: "muted",
  connected: "success",
  degraded: "warning",
  error: "danger",
  disabled: "muted",
};

const STATE_LABEL: Record<ProviderStatusState, string> = {
  disconnected: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  degraded: "Degraded",
  error: "Error",
  disabled: "Disabled",
};

export class ProviderStatus {
  readonly integrationId: IntegrationId;
  readonly state: ProviderStatusState;
  readonly accountCount: number;
  readonly lastCheckedAt: string | null;
  readonly latencyMs: number | null;
  readonly message: string | null;

  constructor(params: {
    integrationId: IntegrationId;
    state: ProviderStatusState;
    accountCount?: number;
    lastCheckedAt?: string | null;
    latencyMs?: number | null;
    message?: string | null;
  }) {
    this.integrationId = params.integrationId;
    this.state = params.state;
    this.accountCount = params.accountCount ?? 0;
    this.lastCheckedAt = params.lastCheckedAt ?? null;
    this.latencyMs = params.latencyMs ?? null;
    this.message = params.message ?? null;
  }

  /** The initial, no-account status for a provider. */
  static disconnected(integrationId: IntegrationId): ProviderStatus {
    return new ProviderStatus({ integrationId, state: "disconnected" });
  }

  /** Administratively disabled (unavailable / feature-flagged off). */
  static disabled(integrationId: IntegrationId, message?: string): ProviderStatus {
    return new ProviderStatus({ integrationId, state: "disabled", message: message ?? null });
  }

  /** True when at least one account is connected and the provider is usable. */
  get isConnected(): boolean {
    return this.state === "connected" || this.state === "degraded";
  }

  /** True only when fully healthy. */
  get isHealthy(): boolean {
    return this.state === "connected";
  }

  get label(): string {
    return STATE_LABEL[this.state];
  }

  get tone(): StatusTone {
    return STATE_TONE[this.state];
  }

  /** Return a copy in a new state (immutable transition). */
  withState(state: ProviderStatusState, message?: string | null): ProviderStatus {
    return new ProviderStatus({
      integrationId: this.integrationId,
      state,
      accountCount: this.accountCount,
      lastCheckedAt: this.lastCheckedAt,
      latencyMs: this.latencyMs,
      message: message ?? this.message,
    });
  }

  /**
   * Derive a connected status from a health probe. If there are no accounts the
   * result is `disconnected` regardless of the probe.
   */
  static fromHealth(
    integrationId: IntegrationId,
    accountCount: number,
    health: HealthStatus | null,
  ): ProviderStatus {
    if (accountCount === 0) {
      return new ProviderStatus({ integrationId, state: "disconnected" });
    }
    const state = ProviderStatus.stateFromHealth(health?.state);
    return new ProviderStatus({
      integrationId,
      state,
      accountCount,
      lastCheckedAt: health?.checkedAt ?? null,
      latencyMs: health?.latencyMs ?? null,
      message: health?.detail ?? null,
    });
  }

  private static stateFromHealth(health: HealthState | undefined): ProviderStatusState {
    switch (health) {
      case "healthy":
        return "connected";
      case "degraded":
        return "degraded";
      case "down":
        return "error";
      default:
        return "connected";
    }
  }

  toSnapshot(): ProviderStatusSnapshot {
    return {
      integrationId: this.integrationId,
      state: this.state,
      connected: this.isConnected,
      accountCount: this.accountCount,
      lastCheckedAt: this.lastCheckedAt,
      latencyMs: this.latencyMs,
      message: this.message,
    };
  }
}

/**
 * Provider-neutral primitives for the Integration Platform.
 *
 * These types name *concepts*, never a specific vendor. Every provider adapter
 * maps its own SDK onto these shapes so features, hooks and UI stay agnostic to
 * which external system is actually connected. Mirrors the AI layer's
 * `src/ai/types/common.ts`.
 */

/**
 * Stable identifier for a supported provider. The trailing `(string & {})` keeps
 * the union *open*: a new provider can be added with its own id without editing
 * this file's consumers (Open/Closed). `mock` is an offline, deterministic
 * provider used until real adapters are wired.
 */
export type IntegrationId =
  | "mock"
  | "slack"
  | "clickup"
  | "github"
  | "figma"
  | "google-drive"
  | "google-docs"
  | "discord"
  | "email"
  | "google-calendar"
  | "n8n"
  | "zapier"
  | "make"
  | "supabase"
  | "cloudflare"
  | "hostinger"
  | (string & {});

/** How an integration is scoped: to one user, or to the whole organization. */
export type IntegrationScope = "user" | "org";

/** Broad grouping for Admin UI organization. */
export type IntegrationCategory = "chat" | "tasks" | "vcs" | "calendar" | "storage" | "other";

/** The auth mechanism a provider's `connect()` flow expects. */
export type IntegrationAuthKind = "oauth2" | "api_token" | "webhook_secret";

/**
 * Coarse capability tags a provider advertises. Features resolve a provider by
 * capability rather than by name, so channels can be swapped freely.
 */
export type IntegrationCapability =
  | "chat.notify"
  | "notify.send"
  | "task.read"
  | "task.write"
  | "vcs.activity"
  | "activity.recent"
  | "automation.workflow"
  | "infra.status"
  | "calendar.sync"
  | "webhook.inbound"
  | "webhook.outbound";

/**
 * Runtime lifecycle state of a connected provider. Distinct from
 * {@link IntegrationCapability} (what it *can* do) — this is what it *is* right
 * now. Modelled richly by {@link ProviderStatus} in `models/`.
 */
export type ProviderStatusState =
  | "disconnected" // no account connected
  | "connecting" // connect() in flight
  | "connected" // healthy and connected
  | "degraded" // connected but a probe/circuit is unhappy
  | "error" // connected but failing (e.g. expired credentials)
  | "disabled"; // administratively turned off

/** Health probe result state (a narrower view than {@link ProviderStatusState}). */
export type HealthState = "healthy" | "degraded" | "down";

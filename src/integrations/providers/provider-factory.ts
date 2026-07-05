/**
 * ProviderFactory — the single place that knows how to construct each adapter.
 *
 * One table maps an {@link IntegrationId} to its metadata + a constructor. This
 * is the ONLY module that names concrete adapter classes: adding a provider is
 * one entry here and nothing else in the platform changes (Open/Closed). Mirrors
 * the `factories` map in `src/ai/providers/registry.ts`, split out so the
 * {@link IntegrationRegistry} can stay focused on memoization.
 */

import type { Integration, IntegrationId, IntegrationMetadata } from "../types";
import type { AccountStore } from "../services/account-store";
import { IntegrationError } from "../services/errors";
import { MockIntegration, MOCK_METADATA } from "./mock-integration";
import { ClickUpIntegration, CLICKUP_METADATA } from "./placeholder-integrations";
import { GitHubIntegration, GITHUB_METADATA } from "../github";
import { FigmaIntegration, FIGMA_METADATA } from "../figma";
import { GoogleDriveIntegration, GOOGLE_DRIVE_METADATA } from "../google-drive";
import { GoogleDocsIntegration, GOOGLE_DOCS_METADATA } from "../google-docs";
import { SlackIntegration, SLACK_METADATA } from "../slack";
import { DiscordIntegration, DISCORD_METADATA } from "../discord";
import { EmailIntegration, EMAIL_METADATA } from "../email";
import { GoogleCalendarIntegration, GOOGLE_CALENDAR_METADATA } from "../google-calendar";
import { N8nIntegration, N8N_METADATA } from "../n8n";
import { ZapierIntegration, ZAPIER_METADATA } from "../zapier";
import { MakeIntegration, MAKE_METADATA } from "../make";
import { SupabasePlatformIntegration, SUPABASE_METADATA } from "../supabase-platform";
import { CloudflareIntegration, CLOUDFLARE_METADATA } from "../cloudflare";
import { HostingerIntegration, HOSTINGER_METADATA } from "../hostinger";

/** A registerable provider: its static metadata + how to build it. */
interface ProviderEntry {
  readonly metadata: IntegrationMetadata;
  readonly create: (store: AccountStore) => Integration;
}

/**
 * The provider table — the extension point. Add a line to register a provider.
 * `metadata` is the same object the constructed adapter exposes, so metadata can
 * be listed (for the Admin UI) without constructing anything.
 */
const PROVIDER_TABLE: Record<string, ProviderEntry> = {
  mock: { metadata: MOCK_METADATA, create: (s) => new MockIntegration(s) },
  slack: { metadata: SLACK_METADATA, create: (s) => new SlackIntegration(s) },
  clickup: { metadata: CLICKUP_METADATA, create: (s) => new ClickUpIntegration(s) },
  github: { metadata: GITHUB_METADATA, create: (s) => new GitHubIntegration(s) },
  figma: { metadata: FIGMA_METADATA, create: (s) => new FigmaIntegration(s) },
  "google-drive": {
    metadata: GOOGLE_DRIVE_METADATA,
    create: (s) => new GoogleDriveIntegration(s),
  },
  "google-docs": {
    metadata: GOOGLE_DOCS_METADATA,
    create: (s) => new GoogleDocsIntegration(s),
  },
  discord: { metadata: DISCORD_METADATA, create: (s) => new DiscordIntegration(s) },
  email: { metadata: EMAIL_METADATA, create: (s) => new EmailIntegration(s) },
  "google-calendar": {
    metadata: GOOGLE_CALENDAR_METADATA,
    create: (s) => new GoogleCalendarIntegration(s),
  },
  n8n: { metadata: N8N_METADATA, create: (s) => new N8nIntegration(s) },
  zapier: { metadata: ZAPIER_METADATA, create: (s) => new ZapierIntegration(s) },
  make: { metadata: MAKE_METADATA, create: (s) => new MakeIntegration(s) },
  supabase: {
    metadata: SUPABASE_METADATA,
    create: (s) => new SupabasePlatformIntegration(s),
  },
  cloudflare: { metadata: CLOUDFLARE_METADATA, create: (s) => new CloudflareIntegration(s) },
  hostinger: { metadata: HOSTINGER_METADATA, create: (s) => new HostingerIntegration(s) },
};

export class ProviderFactory {
  /** True when an adapter is registered for `id`. */
  has(id: IntegrationId): boolean {
    return id in PROVIDER_TABLE;
  }

  /** Every registered provider id. */
  knownIds(): IntegrationId[] {
    return Object.keys(PROVIDER_TABLE);
  }

  /** Static metadata for one provider (no construction). */
  metadataFor(id: IntegrationId): IntegrationMetadata | undefined {
    return PROVIDER_TABLE[id]?.metadata;
  }

  /** All provider metadata, for rendering the catalog. */
  allMetadata(): IntegrationMetadata[] {
    return Object.values(PROVIDER_TABLE).map((e) => e.metadata);
  }

  /** Construct a fresh adapter instance wired to the given store. */
  create(id: IntegrationId, store: AccountStore): Integration {
    const entry = PROVIDER_TABLE[id];
    if (!entry) {
      throw new IntegrationError("unknown_provider", `No adapter registered for provider "${id}".`);
    }
    return entry.create(store);
  }
}

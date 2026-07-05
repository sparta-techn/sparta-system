/** Provider adapters + the factory/registry that resolve them. */

export { BaseIntegration } from "./base-integration";
export type { AuthenticatedIdentity } from "./base-integration";

export { MockIntegration, MOCK_METADATA } from "./mock-integration";
export { ClickUpIntegration, CLICKUP_METADATA } from "./placeholder-integrations";
// Providers with their own folder (adapter + client + services + capability port).
export { GitHubIntegration, GITHUB_METADATA } from "../github";
export { FigmaIntegration, FIGMA_METADATA } from "../figma";
export { GoogleDriveIntegration, GOOGLE_DRIVE_METADATA } from "../google-drive";
export { GoogleDocsIntegration, GOOGLE_DOCS_METADATA } from "../google-docs";
export { SlackIntegration, SLACK_METADATA } from "../slack";
export { DiscordIntegration, DISCORD_METADATA } from "../discord";
export { EmailIntegration, EMAIL_METADATA } from "../email";
export { GoogleCalendarIntegration, GOOGLE_CALENDAR_METADATA } from "../google-calendar";
export { N8nIntegration, N8N_METADATA } from "../n8n";
export { ZapierIntegration, ZAPIER_METADATA } from "../zapier";
export { MakeIntegration, MAKE_METADATA } from "../make";
export { SupabasePlatformIntegration, SUPABASE_METADATA } from "../supabase-platform";
export { CloudflareIntegration, CLOUDFLARE_METADATA } from "../cloudflare";
export { HostingerIntegration, HOSTINGER_METADATA } from "../hostinger";

export { ProviderFactory } from "./provider-factory";
export { IntegrationRegistry } from "./integration-registry";

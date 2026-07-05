/**
 * SpartaFlow Integration Platform — public entry point.
 *
 * Import from here (`@/integrations`) rather than reaching into sub-folders.
 * See `src/integrations/README.md` and `docs/INTEGRATION_ARCHITECTURE.md`.
 *
 * NOTE: this platform is infrastructure only — no external API is connected yet.
 * The offline `mock` provider exercises the full lifecycle; Slack / ClickUp /
 * GitHub are declared placeholders until their `*-client.ts` is wired.
 */

export * from "./types";
export * from "./models";
export * from "./ports";
export * from "./providers";
export * from "./github";
export * from "./figma";
export * from "./google-drive";
export * from "./google-docs";
export * from "./slack";
export * from "./discord";
export * from "./email";
export * from "./google-calendar";
export * from "./automation";
export * from "./n8n";
export * from "./zapier";
export * from "./make";
export * from "./infrastructure";
export * from "./supabase-platform";
export * from "./cloudflare";
export * from "./hostinger";
export * from "./services";
export * from "./hooks";
export * from "./components";

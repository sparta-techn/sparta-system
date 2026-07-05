/**
 * SpartaFlow AI infrastructure.
 *
 * Provider-agnostic core for the AI Assistant. Every consumer depends on the
 * neutral `AIProvider` interface and the `AIEngine` orchestrator — never on a
 * vendor SDK. Provider keys and network calls belong server-side (a Supabase
 * Edge Function); this module is the shared, environment-agnostic core.
 *
 * ```ts
 * import { aiAssistant } from "@/ai";
 * const result = await aiAssistant.run("generate-morning-plan", {
 *   user: { id, displayName, roles },
 *   variables: { date: "2026-07-01" },
 * });
 * ```
 *
 * See `docs/AI_FEATURES.md` for the feature catalog, `docs/AI_INFRASTRUCTURE.md`
 * for the core, and `docs/AI_ARCHITECTURE.md` for the end-to-end design.
 */

export * from "./types";
export * from "./utils";
export * from "./models";
export * from "./providers";
export * from "./prompts";
export * from "./context";
export * from "./services";
export * from "./features";

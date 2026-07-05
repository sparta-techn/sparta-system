/**
 * Figma provider — public surface. Adapter + metadata (registered in
 * `provider-factory.ts`), the client seam, the recent-activity service and the
 * Figma domain types. See `docs/ACTIVITY_INTEGRATIONS.md`.
 */

export { FigmaIntegration, FIGMA_METADATA } from "./figma-integration";
export { FigmaClient } from "./figma-client";
export { FigmaRecentActivityService } from "./figma-recent-activity.service";
export * from "./types";

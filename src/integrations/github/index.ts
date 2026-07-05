/**
 * GitHub provider — public surface.
 *
 * Adapter + metadata (registered in `provider-factory.ts`), the client seam, the
 * feature services, the VCS-port implementation and the GitHub domain types.
 * See `docs/GITHUB.md`.
 */

export { GitHubIntegration, GITHUB_METADATA } from "./github-integration";
export { GitHubClient } from "./github-client";
export { GitHubVcsActivity } from "./github-vcs-activity";
export type { GitHubServices } from "./github-vcs-activity";

export * from "./services";
export * from "./types";

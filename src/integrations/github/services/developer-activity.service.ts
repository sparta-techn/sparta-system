/**
 * Developer Activity — the aggregated contribution signal SpartaFlow's
 * performance/analytics features consume (commits, PRs opened/merged, reviews,
 * issues opened/closed for one developer over a window).
 *
 * GitHub exposes no single "activity" endpoint, so the real implementation will
 * compose this from the commits / pull-requests / issues services rather than a
 * one-shot client call. Today the client seam short-circuits at `notImplemented`;
 * this service is where that fan-out + roll-up logic will live.
 */

import type { GitHubClient } from "../github-client";
import type { GitHubActivityQuery, GitHubDeveloperActivity } from "../types";

export interface DeveloperActivityService {
  summarize(accountId: string, query: GitHubActivityQuery): Promise<GitHubDeveloperActivity>;
}

export class GitHubDeveloperActivityService implements DeveloperActivityService {
  constructor(private readonly client: GitHubClient) {}

  summarize(accountId: string, query: GitHubActivityQuery): Promise<GitHubDeveloperActivity> {
    // Placeholder: delegates to the client seam. The real version will fan out to
    // CommitsService / PullRequestsService / IssuesService and reduce the results.
    return this.client.getDeveloperActivity(accountId, query);
  }
}

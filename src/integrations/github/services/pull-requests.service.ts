/**
 * Pull Requests — list a repository's PRs (open/closed/merged, drafts, reviewers).
 */

import type { GitHubClient } from "../github-client";
import type {
  GitHubListPullRequestsOptions,
  GitHubPage,
  GitHubPullRequest,
  GitHubRepoRef,
} from "../types";

export interface PullRequestsService {
  list(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListPullRequestsOptions,
  ): Promise<GitHubPage<GitHubPullRequest>>;
}

export class GitHubPullRequestsService implements PullRequestsService {
  constructor(private readonly client: GitHubClient) {}

  list(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListPullRequestsOptions,
  ): Promise<GitHubPage<GitHubPullRequest>> {
    return this.client.listPullRequests(accountId, ref, options);
  }
}

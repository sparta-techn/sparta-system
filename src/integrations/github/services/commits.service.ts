/**
 * Commits — repository commit history, optionally filtered by ref/author/date.
 */

import type { GitHubClient } from "../github-client";
import type { GitHubCommit, GitHubListCommitsOptions, GitHubPage, GitHubRepoRef } from "../types";

export interface CommitsService {
  list(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListCommitsOptions,
  ): Promise<GitHubPage<GitHubCommit>>;
}

export class GitHubCommitsService implements CommitsService {
  constructor(private readonly client: GitHubClient) {}

  list(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListCommitsOptions,
  ): Promise<GitHubPage<GitHubCommit>> {
    return this.client.listCommits(accountId, ref, options);
  }
}

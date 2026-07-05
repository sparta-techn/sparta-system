/**
 * Issues — list a repository's issues (state, assignees, labels).
 *
 * NB: GitHub's REST issues endpoint also returns PRs; the real client body will
 * filter those out so this service stays issues-only.
 */

import type { GitHubClient } from "../github-client";
import type { GitHubIssue, GitHubListIssuesOptions, GitHubPage, GitHubRepoRef } from "../types";

export interface IssuesService {
  list(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListIssuesOptions,
  ): Promise<GitHubPage<GitHubIssue>>;
}

export class GitHubIssuesService implements IssuesService {
  constructor(private readonly client: GitHubClient) {}

  list(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListIssuesOptions,
  ): Promise<GitHubPage<GitHubIssue>> {
    return this.client.listIssues(accountId, ref, options);
  }
}

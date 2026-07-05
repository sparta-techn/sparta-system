/**
 * Releases — list a repository's published releases (tags, prerelease flags).
 */

import type { GitHubClient } from "../github-client";
import type { GitHubPage, GitHubRelease, GitHubRepoRef } from "../types";

export interface ReleasesService {
  list(accountId: string, ref: GitHubRepoRef, page?: number): Promise<GitHubPage<GitHubRelease>>;
}

export class GitHubReleasesService implements ReleasesService {
  constructor(private readonly client: GitHubClient) {}

  list(accountId: string, ref: GitHubRepoRef, page?: number): Promise<GitHubPage<GitHubRelease>> {
    return this.client.listReleases(accountId, ref, page);
  }
}

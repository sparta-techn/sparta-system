/**
 * Branches — list the branches of a repository (name, head SHA, protection).
 */

import type { GitHubClient } from "../github-client";
import type { GitHubBranch, GitHubPage, GitHubRepoRef } from "../types";

export interface BranchesService {
  list(accountId: string, ref: GitHubRepoRef, page?: number): Promise<GitHubPage<GitHubBranch>>;
}

export class GitHubBranchesService implements BranchesService {
  constructor(private readonly client: GitHubClient) {}

  list(accountId: string, ref: GitHubRepoRef, page?: number): Promise<GitHubPage<GitHubBranch>> {
    return this.client.listBranches(accountId, ref, page);
  }
}

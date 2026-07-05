/**
 * Repositories — read access to the repos an account can see.
 *
 * Every GitHub feature service follows this shape: a small interface (the
 * contract features/tests depend on) + a class that delegates to
 * {@link GitHubClient}. Services hold NO network code themselves — they add
 * account scoping, defaults and (later) caching around the one client seam.
 */

import type { GitHubClient } from "../github-client";
import type { GitHubListReposOptions, GitHubPage, GitHubRepoRef, GitHubRepository } from "../types";

export interface RepositoriesService {
  list(accountId: string, options?: GitHubListReposOptions): Promise<GitHubPage<GitHubRepository>>;
  get(accountId: string, ref: GitHubRepoRef): Promise<GitHubRepository>;
}

export class GitHubRepositoriesService implements RepositoriesService {
  constructor(private readonly client: GitHubClient) {}

  list(accountId: string, options?: GitHubListReposOptions): Promise<GitHubPage<GitHubRepository>> {
    return this.client.listRepositories(accountId, options);
  }

  get(accountId: string, ref: GitHubRepoRef): Promise<GitHubRepository> {
    return this.client.getRepository(accountId, ref);
  }
}

/**
 * GitHubClient — the single HTTP/SDK seam for GitHub.
 *
 * This is the ONLY file that will ever import a GitHub SDK or issue an HTTP
 * request (the `slack-client.ts` role in `docs/INTEGRATION_ARCHITECTURE.md` §4).
 * Every feature service depends on this class, never on `fetch`/Octokit directly
 * — satisfying CLAUDE.md's "all external communication goes through service
 * classes" rule and keeping the network boundary in one auditable place.
 *
 * STATUS: architecture only. Every method routes through `notImplemented`, so no
 * GitHub API is contacted yet. Wiring the real integration means filling these
 * bodies (resolve a token via `config.resolveToken`, call the API, map the raw
 * payload to the `GitHub*` DTOs) and nothing else in the platform changes.
 */

import { notImplemented } from "../services/errors";
import type {
  GitHubActivityQuery,
  GitHubBranch,
  GitHubClientConfig,
  GitHubCommit,
  GitHubDeveloperActivity,
  GitHubIssue,
  GitHubListCommitsOptions,
  GitHubListIssuesOptions,
  GitHubListPullRequestsOptions,
  GitHubListReposOptions,
  GitHubPage,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepoRef,
  GitHubRepository,
  GitHubUser,
} from "./types";

const DEFAULT_API_BASE_URL = "https://api.github.com";

export class GitHubClient {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: GitHubClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  /** Identity behind an account's credential — used by `authenticate`/`probe`. */
  async getAuthenticatedUser(accountId: string): Promise<GitHubUser> {
    return notImplemented(`GitHubClient.getAuthenticatedUser (account ${accountId})`);
  }

  // ── Repositories ────────────────────────────────────────────────────────────

  async listRepositories(
    accountId: string,
    options?: GitHubListReposOptions,
  ): Promise<GitHubPage<GitHubRepository>> {
    return notImplemented(`GitHubClient.listRepositories (account ${accountId})`);
  }

  async getRepository(accountId: string, ref: GitHubRepoRef): Promise<GitHubRepository> {
    return notImplemented(`GitHubClient.getRepository (${ref.owner}/${ref.repo})`);
  }

  // ── Branches ──────────────────────────────────────────────────────────────

  async listBranches(
    accountId: string,
    ref: GitHubRepoRef,
    page?: number,
  ): Promise<GitHubPage<GitHubBranch>> {
    return notImplemented(`GitHubClient.listBranches (${ref.owner}/${ref.repo})`);
  }

  // ── Commits ────────────────────────────────────────────────────────────────

  async listCommits(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListCommitsOptions,
  ): Promise<GitHubPage<GitHubCommit>> {
    return notImplemented(`GitHubClient.listCommits (${ref.owner}/${ref.repo})`);
  }

  // ── Pull requests ────────────────────────────────────────────────────────────

  async listPullRequests(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListPullRequestsOptions,
  ): Promise<GitHubPage<GitHubPullRequest>> {
    return notImplemented(`GitHubClient.listPullRequests (${ref.owner}/${ref.repo})`);
  }

  // ── Issues ────────────────────────────────────────────────────────────────

  async listIssues(
    accountId: string,
    ref: GitHubRepoRef,
    options?: GitHubListIssuesOptions,
  ): Promise<GitHubPage<GitHubIssue>> {
    return notImplemented(`GitHubClient.listIssues (${ref.owner}/${ref.repo})`);
  }

  // ── Releases ────────────────────────────────────────────────────────────────

  async listReleases(
    accountId: string,
    ref: GitHubRepoRef,
    page?: number,
  ): Promise<GitHubPage<GitHubRelease>> {
    return notImplemented(`GitHubClient.listReleases (${ref.owner}/${ref.repo})`);
  }

  // ── Developer activity ────────────────────────────────────────────────────────

  async getDeveloperActivity(
    accountId: string,
    query: GitHubActivityQuery,
  ): Promise<GitHubDeveloperActivity> {
    return notImplemented(`GitHubClient.getDeveloperActivity (${query.login})`);
  }
}

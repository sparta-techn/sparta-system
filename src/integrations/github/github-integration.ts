/**
 * GitHubIntegration — the GitHub provider adapter.
 *
 * Extends {@link BaseIntegration} (inheriting the six-method lifecycle) and
 * *additionally* implements {@link VcsActivityPort} (repositories, PRs, issues,
 * commits, releases, branches, developer activity). This is the two-layer shape
 * from `docs/INTEGRATION_ARCHITECTURE.md` §4–5: a stable lifecycle contract plus
 * a capability port, with all GitHub specifics behind the port.
 *
 * STATUS: architecture only. The vendor hooks and every port method resolve to a
 * `notImplemented` seam inside {@link GitHubClient}, so no GitHub API is called.
 * Metadata + settings schema are live, so the Admin UI renders GitHub today.
 * `available` stays false until the client bodies are wired.
 */

import type {
  ConnectInput,
  IntegrationAccountData,
  IntegrationMetadata,
  SettingsSchema,
  SyncInput,
  SyncResult,
} from "../types";
import type { AccountStore } from "../services/account-store";
import type {
  VcsActivityPort,
  VcsActivityQuery,
  VcsBranch,
  VcsCommit,
  VcsCommitQuery,
  VcsDeveloperActivity,
  VcsIssue,
  VcsIssueQuery,
  VcsPage,
  VcsPageParams,
  VcsPullRequest,
  VcsPullRequestQuery,
  VcsRelease,
  VcsRepository,
  VcsRepositoryRef,
} from "../ports";
import { BaseIntegration, type AuthenticatedIdentity } from "../providers/base-integration";
import { notImplemented } from "../services/errors";
import { GitHubClient } from "./github-client";
import { GitHubVcsActivity, type GitHubServices } from "./github-vcs-activity";
import type { GitHubClientConfig } from "./types";
import {
  GitHubBranchesService,
  GitHubCommitsService,
  GitHubDeveloperActivityService,
  GitHubIssuesService,
  GitHubPullRequestsService,
  GitHubReleasesService,
  GitHubRepositoriesService,
} from "./services";

export const GITHUB_METADATA: IntegrationMetadata = {
  id: "github",
  displayName: "GitHub",
  description: "Inbound commit / PR / review activity as a performance signal (opt-in).",
  category: "vcs",
  scope: "user",
  auth: "oauth2",
  capabilities: ["vcs.activity", "webhook.inbound"],
  supportsWebhooks: true,
  available: false,
};

export class GitHubIntegration extends BaseIntegration implements VcsActivityPort {
  readonly metadata = GITHUB_METADATA;

  private readonly client: GitHubClient;
  private readonly vcs: GitHubVcsActivity;

  constructor(store: AccountStore, config: GitHubClientConfig = {}) {
    super(store);
    this.client = new GitHubClient(config);
    const services: GitHubServices = {
      repositories: new GitHubRepositoriesService(this.client),
      branches: new GitHubBranchesService(this.client),
      commits: new GitHubCommitsService(this.client),
      pullRequests: new GitHubPullRequestsService(this.client),
      issues: new GitHubIssuesService(this.client),
      releases: new GitHubReleasesService(this.client),
      developerActivity: new GitHubDeveloperActivityService(this.client),
    };
    this.vcs = new GitHubVcsActivity(services);
  }

  // ── Lifecycle vendor hooks (placeholder — no external calls) ─────────────────

  protected async authenticate(_input: ConnectInput): Promise<AuthenticatedIdentity> {
    return notImplemented("GitHub connect (OAuth code exchange)");
  }

  protected async performSync(
    _account: IntegrationAccountData,
    _input: SyncInput,
  ): Promise<SyncResult> {
    return notImplemented("GitHub sync");
  }

  protected async probe(account: IntegrationAccountData): Promise<void> {
    // A real probe is a cheap `GET /user`; the client seam throws for now.
    await this.client.getAuthenticatedUser(account.id);
  }

  protected settingsSchema(): SettingsSchema {
    return {
      fields: [
        {
          key: "org",
          label: "Organization",
          type: "string",
          required: false,
          help: "Restrict activity signals to this GitHub org.",
        },
        {
          key: "includeReviews",
          label: "Count PR reviews",
          type: "boolean",
          required: false,
          default: true,
        },
      ],
    };
  }

  // ── VcsActivityPort — delegated to the composed adapter ──────────────────────

  listRepositories(accountId: string, params?: VcsPageParams): Promise<VcsPage<VcsRepository>> {
    return this.vcs.listRepositories(accountId, params);
  }

  getRepository(accountId: string, ref: VcsRepositoryRef): Promise<VcsRepository> {
    return this.vcs.getRepository(accountId, ref);
  }

  listBranches(
    accountId: string,
    ref: VcsRepositoryRef,
    params?: VcsPageParams,
  ): Promise<VcsPage<VcsBranch>> {
    return this.vcs.listBranches(accountId, ref, params);
  }

  listCommits(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsCommitQuery,
  ): Promise<VcsPage<VcsCommit>> {
    return this.vcs.listCommits(accountId, ref, query);
  }

  listPullRequests(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsPullRequestQuery,
  ): Promise<VcsPage<VcsPullRequest>> {
    return this.vcs.listPullRequests(accountId, ref, query);
  }

  listIssues(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsIssueQuery,
  ): Promise<VcsPage<VcsIssue>> {
    return this.vcs.listIssues(accountId, ref, query);
  }

  listReleases(
    accountId: string,
    ref: VcsRepositoryRef,
    params?: VcsPageParams,
  ): Promise<VcsPage<VcsRelease>> {
    return this.vcs.listReleases(accountId, ref, params);
  }

  getDeveloperActivity(accountId: string, query: VcsActivityQuery): Promise<VcsDeveloperActivity> {
    return this.vcs.getDeveloperActivity(accountId, query);
  }
}

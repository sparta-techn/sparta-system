/**
 * GitHub domain types — the shapes GitHub *speaks*.
 *
 * These mirror the slices of the GitHub REST/GraphQL resources SpartaFlow reads
 * (repos, PRs, issues, commits, releases, branches, activity). They are the
 * vendor-specific counterpart to the neutral `Vcs*` DTOs in
 * `../ports/vcs-activity.ts`: services return these; `github-vcs-activity.ts`
 * maps them onto the neutral port shapes so features stay vendor-blind.
 *
 * Only the fields SpartaFlow actually consumes are modelled — intentionally a
 * subset of GitHub's payloads, not a full SDK typing.
 */

/** GitHub user/organization actor. */
export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
  type: "User" | "Organization" | "Bot";
}

/** owner/repo coordinate — the identity every resource call needs. */
export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export interface GitHubRepository {
  id: number;
  nodeId: string;
  name: string;
  fullName: string;
  owner: GitHubUser;
  description?: string;
  private: boolean;
  archived: boolean;
  defaultBranch: string;
  htmlUrl: string;
  pushedAt?: string;
  updatedAt: string;
}

export interface GitHubBranch {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: GitHubUser;
  authoredAt: string;
  htmlUrl: string;
  stats?: { additions: number; deletions: number; total: number };
}

export type GitHubPullRequestState = "open" | "closed";

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: GitHubPullRequestState;
  /** GitHub reports merge via a timestamp, not the `state` enum. */
  merged: boolean;
  mergedAt?: string;
  closedAt?: string;
  draft: boolean;
  user: GitHubUser;
  headRef: string;
  baseRef: string;
  requestedReviewers: readonly GitHubUser[];
  createdAt: string;
  htmlUrl: string;
}

export type GitHubIssueState = "open" | "closed";

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: GitHubIssueState;
  user: GitHubUser;
  assignees: readonly GitHubUser[];
  labels: readonly string[];
  createdAt: string;
  closedAt?: string;
  htmlUrl: string;
}

export interface GitHubRelease {
  id: number;
  tagName: string;
  name?: string;
  author: GitHubUser;
  prerelease: boolean;
  draft: boolean;
  publishedAt?: string;
  htmlUrl: string;
}

/**
 * Aggregated per-developer contribution counts over a window. GitHub has no
 * single endpoint for this — the DeveloperActivity service composes it from
 * commits / PRs / reviews / issues (all placeholder for now).
 */
export interface GitHubDeveloperActivity {
  user: GitHubUser;
  from: string;
  to: string;
  commitCount: number;
  pullRequestsOpened: number;
  pullRequestsMerged: number;
  reviewsSubmitted: number;
  issuesOpened: number;
  issuesClosed: number;
}

// ── Request option types (mirror GitHub query params) ────────────────────────

/** Page-number pagination as GitHub's REST API uses it. */
export interface GitHubPageParams {
  page?: number;
  perPage?: number;
}

export interface GitHubListReposOptions extends GitHubPageParams {
  /** Restrict to a specific org; omit for the authenticated user's repos. */
  org?: string;
  sort?: "created" | "updated" | "pushed" | "full_name";
  direction?: "asc" | "desc";
}

export interface GitHubListPullRequestsOptions extends GitHubPageParams {
  state?: GitHubPullRequestState | "all";
  head?: string;
  base?: string;
}

export interface GitHubListIssuesOptions extends GitHubPageParams {
  state?: GitHubIssueState | "all";
  assignee?: string;
  labels?: readonly string[];
}

export interface GitHubListCommitsOptions extends GitHubPageParams {
  sha?: string;
  author?: string;
  since?: string;
  until?: string;
}

export interface GitHubActivityQuery {
  login: string;
  from: string;
  to: string;
  repo?: GitHubRepoRef;
}

/**
 * One page of a GitHub list call. GitHub paginates via `Link` headers; we expose
 * the next page number the client parsed out (absent = last page).
 */
export interface GitHubPage<T> {
  items: readonly T[];
  nextPage?: number;
}

/**
 * Adapter configuration. `resolveToken` is the seam that will later decrypt the
 * account's `credentialRef` into a bearer token; today it is never invoked
 * because every client call short-circuits at `notImplemented`.
 */
export interface GitHubClientConfig {
  /** REST base, e.g. https://api.github.com or a GHE host. */
  apiBaseUrl?: string;
  /** Per-account token resolver (wired when the real client lands). */
  resolveToken?: (accountId: string) => Promise<string>;
}

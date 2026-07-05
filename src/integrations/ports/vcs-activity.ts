/**
 * VcsActivityPort — the capability port for version-control activity.
 *
 * This is the vendor-neutral contract a feature depends on when it wants
 * repositories, pull requests, issues, commits, releases, branches or
 * developer-activity signals — the same role `ChatNotifierPort` /
 * `TaskProviderPort` play in `docs/INTEGRATION_ARCHITECTURE.md` §5.
 *
 * A feature resolves this port by capability (`"vcs.activity"`) and never names
 * GitHub, GitLab or Bitbucket. Each provider adapter (see `github/`) additionally
 * implements this interface and maps its own SDK shapes onto the neutral DTOs
 * below, so swapping or adding a VCS provider changes no feature code.
 *
 * NB: this file declares *types only*. No adapter here calls a network — the
 * GitHub implementation routes every method through a `notImplemented` seam until
 * a real client is wired.
 */

// ── Neutral DTOs (no vendor-specific fields) ─────────────────────────────────

/** A person acting in a VCS: commit author, PR reviewer, issue assignee. */
export interface VcsActor {
  /** Stable provider id for the actor. */
  id: string;
  /** Handle/username (e.g. GitHub login). */
  login: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Points at one repository within an owner/org. */
export interface VcsRepositoryRef {
  owner: string;
  name: string;
}

export interface VcsRepository {
  id: string;
  ref: VcsRepositoryRef;
  description?: string;
  defaultBranch: string;
  isPrivate: boolean;
  isArchived: boolean;
  url: string;
  updatedAt: string;
}

export interface VcsBranch {
  name: string;
  /** Commit SHA the branch currently points at. */
  headSha: string;
  isProtected: boolean;
  isDefault: boolean;
}

export interface VcsCommit {
  sha: string;
  message: string;
  author: VcsActor;
  authoredAt: string;
  url: string;
  /** Lines added/removed, when the provider reports them. */
  additions?: number;
  deletions?: number;
}

export type VcsPullRequestState = "open" | "closed" | "merged";

export interface VcsPullRequest {
  id: string;
  number: number;
  title: string;
  state: VcsPullRequestState;
  author: VcsActor;
  sourceBranch: string;
  targetBranch: string;
  isDraft: boolean;
  reviewers: readonly VcsActor[];
  createdAt: string;
  mergedAt?: string;
  closedAt?: string;
  url: string;
}

export type VcsIssueState = "open" | "closed";

export interface VcsIssue {
  id: string;
  number: number;
  title: string;
  state: VcsIssueState;
  author: VcsActor;
  assignees: readonly VcsActor[];
  labels: readonly string[];
  createdAt: string;
  closedAt?: string;
  url: string;
}

export interface VcsRelease {
  id: string;
  tag: string;
  name?: string;
  author: VcsActor;
  isPrerelease: boolean;
  isDraft: boolean;
  publishedAt?: string;
  url: string;
}

/**
 * Aggregated contribution signal for one actor over a window — the shape the
 * Developer Activity / performance features consume. Derived (never raw), so it
 * stays comparable across providers.
 */
export interface VcsDeveloperActivity {
  actor: VcsActor;
  periodStart: string;
  periodEnd: string;
  commits: number;
  pullRequestsOpened: number;
  pullRequestsMerged: number;
  reviewsSubmitted: number;
  issuesOpened: number;
  issuesClosed: number;
}

// ── Query / pagination primitives ────────────────────────────────────────────

/** Opaque forward-only pagination, provider-agnostic (cursor, not page number). */
export interface VcsPageParams {
  /** Cursor returned as `nextCursor` by the previous page; absent = first page. */
  cursor?: string;
  /** Requested page size; the provider may clamp it. */
  perPage?: number;
}

/** One page of results plus the cursor to fetch the next. */
export interface VcsPage<T> {
  items: readonly T[];
  /** Absent when there are no further pages. */
  nextCursor?: string;
}

export interface VcsPullRequestQuery extends VcsPageParams {
  state?: VcsPullRequestState | "all";
  /** Restrict to PRs authored by this login. */
  author?: string;
}

export interface VcsIssueQuery extends VcsPageParams {
  state?: VcsIssueState | "all";
  assignee?: string;
  labels?: readonly string[];
}

export interface VcsCommitQuery extends VcsPageParams {
  /** Branch, tag or SHA to list history from. */
  ref?: string;
  author?: string;
  /** ISO timestamp lower bound (inclusive). */
  since?: string;
  until?: string;
}

/** Window + subject for a developer-activity roll-up. */
export interface VcsActivityQuery {
  /** Actor login to summarise. */
  login: string;
  periodStart: string;
  periodEnd: string;
  /** Optional repository restriction; omit to span all accessible repos. */
  repo?: VcsRepositoryRef;
}

// ── The port ─────────────────────────────────────────────────────────────────

/**
 * Read-only version-control activity. Every method is scoped by `accountId` (a
 * connected {@link import("../types").IntegrationAccountData}) so one adapter
 * instance can serve many connected accounts.
 */
export interface VcsActivityPort {
  listRepositories(accountId: string, params?: VcsPageParams): Promise<VcsPage<VcsRepository>>;
  getRepository(accountId: string, ref: VcsRepositoryRef): Promise<VcsRepository>;

  listBranches(
    accountId: string,
    ref: VcsRepositoryRef,
    params?: VcsPageParams,
  ): Promise<VcsPage<VcsBranch>>;

  listCommits(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsCommitQuery,
  ): Promise<VcsPage<VcsCommit>>;

  listPullRequests(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsPullRequestQuery,
  ): Promise<VcsPage<VcsPullRequest>>;

  listIssues(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsIssueQuery,
  ): Promise<VcsPage<VcsIssue>>;

  listReleases(
    accountId: string,
    ref: VcsRepositoryRef,
    params?: VcsPageParams,
  ): Promise<VcsPage<VcsRelease>>;

  getDeveloperActivity(accountId: string, query: VcsActivityQuery): Promise<VcsDeveloperActivity>;
}

/**
 * Structural guard: does an adapter implement the VCS activity port? Lets the
 * registry hand back a typed port from a resolved {@link import("../types").Integration}.
 */
export function isVcsActivityPort(value: unknown): value is VcsActivityPort {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.listRepositories === "function" &&
    typeof candidate.listPullRequests === "function" &&
    typeof candidate.getDeveloperActivity === "function"
  );
}

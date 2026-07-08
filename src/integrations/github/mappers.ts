/**
 * Pure mappers: GitHub domain DTOs → neutral `Vcs*` port DTOs.
 *
 * This is the ports-and-adapters boundary made concrete — the one place GitHub's
 * vocabulary is translated into the vendor-neutral shapes features consume. No
 * I/O, no state: each function is a total, testable transform. (They compile and
 * are exercised the moment the client seam returns real data.)
 */

import type {
  VcsActor,
  VcsBranch,
  VcsCommit,
  VcsIssue,
  VcsPage,
  VcsPullRequest,
  VcsPullRequestState,
  VcsRelease,
  VcsRepository,
  VcsDeveloperActivity,
} from "../ports";
import type {
  GitHubBranch,
  GitHubCommit,
  GitHubDeveloperActivity,
  GitHubIssue,
  GitHubPage,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
  GitHubUser,
} from "./types";

export function toVcsActor(user: GitHubUser): VcsActor {
  return {
    id: String(user.id),
    login: user.login,
    displayName: user.name,
    avatarUrl: user.avatarUrl,
  };
}

export function toVcsRepository(repo: GitHubRepository): VcsRepository {
  return {
    id: String(repo.id),
    ref: { owner: repo.owner.login, name: repo.name },
    description: repo.description,
    defaultBranch: repo.defaultBranch,
    isPrivate: repo.private,
    isArchived: repo.archived,
    url: repo.htmlUrl,
    updatedAt: repo.updatedAt,
  };
}

export function toVcsBranch(branch: GitHubBranch, defaultBranch?: string): VcsBranch {
  return {
    name: branch.name,
    headSha: branch.commitSha,
    isProtected: branch.protected,
    isDefault: branch.name === defaultBranch,
  };
}

export function toVcsCommit(commit: GitHubCommit): VcsCommit {
  return {
    sha: commit.sha,
    message: commit.message,
    author: toVcsActor(commit.author),
    authoredAt: commit.authoredAt,
    url: commit.htmlUrl,
    additions: commit.stats?.additions,
    deletions: commit.stats?.deletions,
  };
}

function toPullRequestState(pr: GitHubPullRequest): VcsPullRequestState {
  if (pr.merged) return "merged";
  return pr.state === "open" ? "open" : "closed";
}

export function toVcsPullRequest(pr: GitHubPullRequest): VcsPullRequest {
  return {
    id: String(pr.id),
    number: pr.number,
    title: pr.title,
    state: toPullRequestState(pr),
    author: toVcsActor(pr.user),
    sourceBranch: pr.headRef,
    targetBranch: pr.baseRef,
    isDraft: pr.draft,
    reviewers: pr.requestedReviewers.map(toVcsActor),
    createdAt: pr.createdAt,
    mergedAt: pr.mergedAt,
    closedAt: pr.closedAt,
    url: pr.htmlUrl,
  };
}

export function toVcsIssue(issue: GitHubIssue): VcsIssue {
  return {
    id: String(issue.id),
    number: issue.number,
    title: issue.title,
    state: issue.state,
    author: toVcsActor(issue.user),
    assignees: issue.assignees.map(toVcsActor),
    labels: issue.labels,
    createdAt: issue.createdAt,
    closedAt: issue.closedAt,
    url: issue.htmlUrl,
  };
}

export function toVcsRelease(release: GitHubRelease): VcsRelease {
  return {
    id: String(release.id),
    tag: release.tagName,
    name: release.name,
    author: toVcsActor(release.author),
    isPrerelease: release.prerelease,
    isDraft: release.draft,
    publishedAt: release.publishedAt,
    url: release.htmlUrl,
  };
}

export function toVcsDeveloperActivity(activity: GitHubDeveloperActivity): VcsDeveloperActivity {
  return {
    actor: toVcsActor(activity.user),
    periodStart: activity.from,
    periodEnd: activity.to,
    commits: activity.commitCount,
    pullRequestsOpened: activity.pullRequestsOpened,
    pullRequestsMerged: activity.pullRequestsMerged,
    reviewsSubmitted: activity.reviewsSubmitted,
    issuesOpened: activity.issuesOpened,
    issuesClosed: activity.issuesClosed,
  };
}

/**
 * Wrap a GitHub page into a neutral page, mapping items and turning GitHub's
 * numeric `nextPage` into the port's opaque `nextCursor`.
 */
export function toVcsPage<TGitHub, TVcs>(
  page: GitHubPage<TGitHub>,
  mapItem: (item: TGitHub) => TVcs,
): VcsPage<TVcs> {
  return {
    items: page.items.map(mapItem),
    nextCursor: page.nextPage === undefined ? undefined : String(page.nextPage),
  };
}

/** Parse an opaque forward cursor back into GitHub's 1-based page number. */
export function cursorToPage(cursor?: string): number | undefined {
  if (cursor === undefined) return undefined;
  const page = Number.parseInt(cursor, 10);
  return Number.isFinite(page) ? page : undefined;
}

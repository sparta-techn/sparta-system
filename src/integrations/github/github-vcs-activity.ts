/**
 * GitHubVcsActivity — GitHub's implementation of the neutral {@link VcsActivityPort}.
 *
 * It composes the seven feature services and translates between the neutral port
 * vocabulary (cursors, `Vcs*` DTOs) and GitHub's (page numbers, `GitHub*` DTOs)
 * via the pure functions in `mappers.ts`. A feature holding a `VcsActivityPort`
 * never sees any of this — that is the whole point of the port.
 */

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
import type {
  GitHubIssueState,
  GitHubPullRequestState,
  GitHubRepoRef,
} from "./types";
import type {
  BranchesService,
  CommitsService,
  DeveloperActivityService,
  IssuesService,
  PullRequestsService,
  ReleasesService,
  RepositoriesService,
} from "./services";
import {
  cursorToPage,
  toVcsBranch,
  toVcsCommit,
  toVcsDeveloperActivity,
  toVcsIssue,
  toVcsPage,
  toVcsPullRequest,
  toVcsRelease,
  toVcsRepository,
} from "./mappers";

/** The feature services this adapter composes (constructor-injected). */
export interface GitHubServices {
  repositories: RepositoriesService;
  branches: BranchesService;
  commits: CommitsService;
  pullRequests: PullRequestsService;
  issues: IssuesService;
  releases: ReleasesService;
  developerActivity: DeveloperActivityService;
}

const toRepoRef = (ref: VcsRepositoryRef): GitHubRepoRef => ({ owner: ref.owner, repo: ref.name });

export class GitHubVcsActivity implements VcsActivityPort {
  constructor(private readonly services: GitHubServices) {}

  async listRepositories(
    accountId: string,
    params?: VcsPageParams,
  ): Promise<VcsPage<VcsRepository>> {
    const page = await this.services.repositories.list(accountId, {
      page: cursorToPage(params?.cursor),
      perPage: params?.perPage,
    });
    return toVcsPage(page, toVcsRepository);
  }

  async getRepository(accountId: string, ref: VcsRepositoryRef): Promise<VcsRepository> {
    const repo = await this.services.repositories.get(accountId, toRepoRef(ref));
    return toVcsRepository(repo);
  }

  async listBranches(
    accountId: string,
    ref: VcsRepositoryRef,
    params?: VcsPageParams,
  ): Promise<VcsPage<VcsBranch>> {
    const page = await this.services.branches.list(
      accountId,
      toRepoRef(ref),
      cursorToPage(params?.cursor),
    );
    return toVcsPage(page, (branch) => toVcsBranch(branch));
  }

  async listCommits(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsCommitQuery,
  ): Promise<VcsPage<VcsCommit>> {
    const page = await this.services.commits.list(accountId, toRepoRef(ref), {
      page: cursorToPage(query?.cursor),
      perPage: query?.perPage,
      sha: query?.ref,
      author: query?.author,
      since: query?.since,
      until: query?.until,
    });
    return toVcsPage(page, toVcsCommit);
  }

  async listPullRequests(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsPullRequestQuery,
  ): Promise<VcsPage<VcsPullRequest>> {
    const page = await this.services.pullRequests.list(accountId, toRepoRef(ref), {
      page: cursorToPage(query?.cursor),
      perPage: query?.perPage,
      state: toGitHubPrState(query?.state),
    });
    return toVcsPage(page, toVcsPullRequest);
  }

  async listIssues(
    accountId: string,
    ref: VcsRepositoryRef,
    query?: VcsIssueQuery,
  ): Promise<VcsPage<VcsIssue>> {
    const page = await this.services.issues.list(accountId, toRepoRef(ref), {
      page: cursorToPage(query?.cursor),
      perPage: query?.perPage,
      state: toGitHubIssueState(query?.state),
      assignee: query?.assignee,
      labels: query?.labels,
    });
    return toVcsPage(page, toVcsIssue);
  }

  async listReleases(
    accountId: string,
    ref: VcsRepositoryRef,
    params?: VcsPageParams,
  ): Promise<VcsPage<VcsRelease>> {
    const page = await this.services.releases.list(
      accountId,
      toRepoRef(ref),
      cursorToPage(params?.cursor),
    );
    return toVcsPage(page, toVcsRelease);
  }

  async getDeveloperActivity(
    accountId: string,
    query: VcsActivityQuery,
  ): Promise<VcsDeveloperActivity> {
    const activity = await this.services.developerActivity.summarize(accountId, {
      login: query.login,
      from: query.periodStart,
      to: query.periodEnd,
      repo: query.repo ? toRepoRef(query.repo) : undefined,
    });
    return toVcsDeveloperActivity(activity);
  }
}

/** Neutral PR state → GitHub's (which folds "merged" back into "closed"). */
function toGitHubPrState(
  state: VcsPullRequestQuery["state"],
): GitHubPullRequestState | "all" | undefined {
  if (state === undefined) return undefined;
  if (state === "all" || state === "open" || state === "closed") return state;
  return "closed"; // "merged" is a closed PR on GitHub's side
}

function toGitHubIssueState(
  state: VcsIssueQuery["state"],
): GitHubIssueState | "all" | undefined {
  return state;
}

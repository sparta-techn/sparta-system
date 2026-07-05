/** The seven GitHub feature services — one per capability area. */

export type { RepositoriesService } from "./repositories.service";
export { GitHubRepositoriesService } from "./repositories.service";

export type { BranchesService } from "./branches.service";
export { GitHubBranchesService } from "./branches.service";

export type { CommitsService } from "./commits.service";
export { GitHubCommitsService } from "./commits.service";

export type { PullRequestsService } from "./pull-requests.service";
export { GitHubPullRequestsService } from "./pull-requests.service";

export type { IssuesService } from "./issues.service";
export { GitHubIssuesService } from "./issues.service";

export type { ReleasesService } from "./releases.service";
export { GitHubReleasesService } from "./releases.service";

export type { DeveloperActivityService } from "./developer-activity.service";
export { GitHubDeveloperActivityService } from "./developer-activity.service";

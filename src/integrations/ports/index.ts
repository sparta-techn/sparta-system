/**
 * Capability ports — small interfaces an adapter *additionally* implements on top
 * of the six-method {@link import("../types").Integration} lifecycle. Features
 * resolve a port by capability and stay vendor-blind. See
 * `docs/INTEGRATION_ARCHITECTURE.md` §5.
 */

export type {
  VcsActor,
  VcsRepositoryRef,
  VcsRepository,
  VcsBranch,
  VcsCommit,
  VcsPullRequest,
  VcsPullRequestState,
  VcsIssue,
  VcsIssueState,
  VcsRelease,
  VcsDeveloperActivity,
  VcsPageParams,
  VcsPage,
  VcsPullRequestQuery,
  VcsIssueQuery,
  VcsCommitQuery,
  VcsActivityQuery,
  VcsActivityPort,
} from "./vcs-activity";

export { isVcsActivityPort } from "./vcs-activity";

export type {
  ActivityActor,
  ActivityAction,
  ActivityResource,
  ActivityItem,
  ActivityPageParams,
  ActivityPage,
  RecentActivityPort,
} from "./recent-activity";

export { isRecentActivityPort } from "./recent-activity";

export type {
  NotificationKind,
  NotificationPriority,
  NotificationAction,
  MeetingDetails,
  NotificationTarget,
  Notification,
  NotificationRequest,
  DeliveryState,
  DeliveryResult,
  NotifierPort,
} from "./notifier";

export { NOTIFICATION_KINDS, isNotifierPort, skipped } from "./notifier";

export type {
  WorkflowRef,
  WorkflowRunStatus,
  WorkflowRun,
  WorkflowTriggerRequest,
  RawWebhookDelivery,
  IncomingWebhookEvent,
  OutgoingWebhookMessage,
  WebhookDeliveryState,
  WebhookDeliveryResult,
  RetryPolicy,
  DeliveryAttempt,
  QueuedDelivery,
  DeadLetterEntry,
  EnqueueInput,
  RetryQueue,
  DeadLetterQueue,
  RetryRunSummary,
  AutomationPort,
} from "./automation";

export { isAutomationPort } from "./automation";

export type {
  InfrastructureCheck,
  InfraState,
  InfraStatusBase,
  DeploymentPhase,
  DeploymentStatus,
  StorageBucketUsage,
  StorageStatus,
  DnsRecordStatus,
  DnsStatus,
  SslStatus,
  ServerInfo,
  InfrastructurePort,
} from "./infrastructure";

export { INFRASTRUCTURE_CHECKS, isInfrastructurePort } from "./infrastructure";

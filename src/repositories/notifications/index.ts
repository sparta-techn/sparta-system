/**
 * Collaboration / inbox repository layer (migration 20260701120000).
 *
 * Domain-facing data API over the collaboration services. Import the singletons
 * from `@/repositories/notifications`.
 *
 * NOTE: intentionally NOT re-exported from the root `@/repositories` barrel —
 * same convention as `@/repositories/projects`, `hr`, `attendance`, `reports`.
 * Approval requests live here (the inbox domain) rather than a separate
 * `repositories/approvals/` folder.
 *
 *   Notification CRUD        → {@link NotificationRepository}
 *   Notification preferences → {@link NotificationPreferenceRepository}
 *   Mentions                 → {@link MentionRepository}
 *   Approval requests        → {@link ApprovalRepository}
 */
export { NotificationRepository, notificationRepository } from "./notification.repository";
export {
  NotificationPreferenceRepository,
  notificationPreferenceRepository,
} from "./notification-preference.repository";
export { MentionRepository, mentionRepository } from "./mention.repository";
export { ApprovalRepository, approvalRepository } from "./approval.repository";

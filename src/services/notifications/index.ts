export { NotificationsService, notificationsService } from "./notifications.service";
export {
  NotificationPreferencesService,
  notificationPreferencesService,
} from "./preferences.service";
export { MentionsService, mentionsService } from "./mentions.service";

// Collaboration rules — event → notification mapping + delivery gate (pure).
export {
  CATEGORY_BY_EVENT,
  categoryForEvent,
  isSelfAction,
  isCategoryMuted,
  isWithinQuietHours,
  shouldGenerate,
  buildNotification,
  generateNotification,
} from "./rules";
export type {
  CollaborationEvent,
  CollaborationEventName,
  TaskAssignedEvent,
  TaskStatusChangedEvent,
  MentionReceivedEvent,
  DependencyAssignedEvent,
  CommentAddedEvent,
  SprintStartedEvent,
  SprintCompletedEvent,
  AttendanceApprovedEvent,
  LeaveApprovedEvent,
} from "./rules";

export type {
  NotificationRow,
  NotificationInsert,
  NotificationUpdate,
  NotificationType,
  NotificationPriority,
  NotificationState,
  NotificationCategory,
  NotificationAction,
  NotificationPreferencesRow,
  NotificationPreferencesUpsert,
  NotificationPreferencesUpdate,
  MentionRow,
  MentionInsert,
  MentionUpdate,
  MentionSource,
} from "./types";

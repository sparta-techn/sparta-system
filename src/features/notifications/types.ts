/**
 * Notifications & Automation Engine — type contracts.
 *
 * Business modules NEVER import notification components or call delivery code.
 * They publish events (see `event-bus.ts`); the automation engine turns
 * events into notifications and the channel registry delivers them.
 */

// ---------- Events ----------

export type EventCategory =
  | "attendance"
  | "checkin"
  | "midday"
  | "eod"
  | "dependency"
  | "announcement"
  | "user"
  | "system"
  | "task"
  | "sprint"
  | "comment"
  | "mention"
  | "leave";

export type EventName =
  // attendance
  | "attendance.checked_in"
  | "attendance.checked_out"
  | "attendance.break_started"
  | "attendance.break_ended"
  | "attendance.late"
  | "attendance.absent"
  // morning check-in
  | "checkin.submitted"
  | "checkin.edited"
  | "checkin.missing"
  // midday
  | "midday.submitted"
  | "midday.updated"
  | "midday.missing"
  // EOD
  | "eod.submitted"
  | "eod.updated"
  | "eod.missing"
  // dependency
  | "dependency.created"
  | "dependency.assigned"
  | "dependency.accepted"
  | "dependency.rejected"
  | "dependency.blocked"
  | "dependency.resolved"
  | "dependency.comment_added"
  | "dependency.mentioned"
  | "dependency.overdue"
  // announcements
  | "announcement.published"
  | "announcement.scheduled"
  | "announcement.updated"
  | "announcement.expired"
  // user
  | "user.invited"
  | "user.activated"
  | "user.disabled"
  | "user.password_reset"
  | "user.role_changed"
  // task
  | "task.assigned"
  | "task.status_changed"
  // sprint
  | "sprint.started"
  | "sprint.completed"
  // mention (generic — task/comment/project, not just dependencies)
  | "mention.received"
  // comment (generic)
  | "comment.added"
  // approvals
  | "attendance.approved"
  | "leave.approved";

export interface DomainEvent<P = Record<string, unknown>> {
  id: string;
  name: EventName;
  category: EventCategory;
  /** Actor that caused the event. `system` for scheduled rules. */
  actorId: string | "system";
  /** Primary subject of the event (employee, dep id, etc.). */
  subjectId?: string;
  payload: P;
  occurredAt: string;
}

// ---------- Notifications ----------

export type NotificationType = "info" | "success" | "warning" | "critical" | "reminder";
export type NotificationPriority = "low" | "normal" | "high" | "critical";
export type NotificationLifecycle =
  | "created"
  | "delivered"
  | "read"
  | "archived"
  | "deleted"
  | "expired";

export type DeliveryChannel =
  | "in_app"
  // future — registered but not implemented
  | "email"
  | "slack"
  | "teams"
  | "telegram"
  | "whatsapp"
  | "push"
  | "sms";

export type PreferenceCategory =
  | "attendance"
  | "dependencies"
  | "announcements"
  | "reports"
  | "mentions"
  | "system"
  | "tasks"
  | "approvals";

export interface NotificationAction {
  label: string;
  /** Internal route, opened with the router. */
  href?: string;
  kind?: "primary" | "secondary";
}

export interface AppNotification {
  id: string;
  /** Event that produced this notification (for traceability). */
  eventId: string;
  eventName: EventName;
  category: PreferenceCategory;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  /** Recipient user id. */
  recipientId: string;
  /** Channels that handled this notification. */
  channels: DeliveryChannel[];
  actions?: NotificationAction[];
  /** Optional deep-link target shown by the row click. */
  href?: string;
  createdAt: string;
  readAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  expiresAt?: string | null;
  /** Free-form context used by widgets/filters. */
  meta?: Record<string, unknown>;
}

// ---------- Recipient targeting ----------

export type RecipientRule =
  | { kind: "employee"; userId: string }
  | { kind: "manager"; ofUserId: string }
  | { kind: "hr" }
  | { kind: "owner" }
  | { kind: "department"; department: string }
  | { kind: "role"; role: "employee" | "manager" | "hr" | "owner" }
  | { kind: "user"; userId: string };

// ---------- Automation rules ----------

export interface AutomationRule<P = Record<string, unknown>> {
  id: string;
  /** Human-readable description for ops/debug. */
  description: string;
  /** Event names this rule reacts to. */
  on: EventName[];
  /** Optional predicate — return false to skip. */
  when?: (event: DomainEvent<P>) => boolean;
  /** Produce one or more notification specs. */
  build: (event: DomainEvent<P>) => NotificationSpec[];
}

export interface NotificationSpec {
  recipients: RecipientRule[];
  category: PreferenceCategory;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  channels?: DeliveryChannel[];
  actions?: NotificationAction[];
  href?: string;
  /** TTL minutes; defaults to 30 days. */
  ttlMinutes?: number;
  meta?: Record<string, unknown>;
}

// ---------- User preferences ----------

export interface NotificationPreferences {
  categories: Record<PreferenceCategory, boolean>;
  channels: Record<DeliveryChannel, boolean>;
  /** Quiet hours (24h, local). When inside, only "critical" notifications surface. */
  quietHours?: { start: string; end: string; enabled: boolean };
}

/**
 * NotifierPort — the capability port for *outbound notifications*.
 *
 * Slack, Discord, Email and Google Calendar are all delivery channels for the
 * same SpartaFlow notifications: daily reports, sprint updates, mentions,
 * approval requests, meeting reminders. Rather than widen the six-method
 * `Integration` lifecycle, delivery is a capability port an adapter additionally
 * implements (Architecture doc §5) — the channel-neutral generalization of the
 * `ChatNotifierPort` sketched there.
 *
 * A feature builds ONE neutral {@link Notification} and hands it to whichever
 * provider(s) are configured; it never formats a Slack block or an email body.
 * Each adapter maps the neutral payload onto its vendor shape behind a
 * `notImplemented` client seam — no network is called here.
 */

/**
 * The kind of notification being sent. Drives per-provider formatting (e.g. an
 * approval request renders action buttons; a meeting reminder renders event
 * details) and lets a provider advertise which kinds it can deliver.
 */
export type NotificationKind =
  | "generic"
  | "daily_report"
  | "sprint_update"
  | "mention"
  | "approval_request"
  | "meeting_reminder";

/** Every kind, in display order — the default `supportedKinds` for a full channel. */
export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  "generic",
  "daily_report",
  "sprint_update",
  "mention",
  "approval_request",
  "meeting_reminder",
];

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

/** An actionable button/link — e.g. Approve / Reject on an approval request. */
export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  style?: "primary" | "default" | "danger";
}

/** Extra detail for `meeting_reminder` notifications. */
export interface MeetingDetails {
  /** ISO start instant. */
  startAt: string;
  endAt?: string;
  location?: string;
  joinUrl?: string;
  attendees?: readonly string[];
}

/**
 * Where a notification is delivered. A tagged union so each channel accepts only
 * the target shapes it understands (a provider skips targets it can't route).
 */
export type NotificationTarget =
  | { type: "user"; ref: string }
  | { type: "channel"; ref: string }
  | { type: "email"; address: string }
  | { type: "calendar"; ref: string };

/** The neutral, channel-agnostic notification payload. */
export interface Notification {
  kind: NotificationKind;
  title: string;
  body: string;
  priority?: NotificationPriority;
  /** Primary link (e.g. the report, the sprint board, the thing to approve). */
  link?: string;
  /** Actionable buttons — chiefly for `approval_request`. */
  actions?: readonly NotificationAction[];
  /** Required for `meeting_reminder`; ignored otherwise. */
  meeting?: MeetingDetails;
  /** Free-form neutral metadata for provider-specific rendering. */
  data?: Record<string, unknown>;
}

export interface NotificationRequest {
  target: NotificationTarget;
  notification: Notification;
  /** Idempotency key so a retry never double-sends. */
  dedupeKey?: string;
}

export type DeliveryState = "delivered" | "queued" | "skipped" | "failed";

export interface DeliveryResult {
  state: DeliveryState;
  kind: NotificationKind;
  target: NotificationTarget;
  /** Provider message/event id when delivered or queued. */
  externalId?: string;
  /** Why a delivery was skipped/failed (e.g. "kind not supported"). */
  detail?: string;
}

/**
 * Outbound notification delivery for one connected account. Scoped by
 * `accountId` so a single adapter instance serves many connected accounts.
 */
export interface NotifierPort {
  /** The notification kinds this channel can deliver. */
  readonly supportedKinds: readonly NotificationKind[];

  /** True when `kind` is in {@link supportedKinds}. */
  supports(kind: NotificationKind): boolean;

  /**
   * Deliver one notification. Must be idempotent per `dedupeKey`. A provider that
   * can't route the target or doesn't support the kind returns a `skipped`
   * result rather than throwing.
   */
  notify(accountId: string, request: NotificationRequest): Promise<DeliveryResult>;
}

/** Structural guard: does an adapter implement the notifier port? */
export function isNotifierPort(value: unknown): value is NotifierPort {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.notify === "function" &&
    typeof candidate.supports === "function" &&
    Array.isArray(candidate.supportedKinds)
  );
}

/** Build a `skipped` result — shared by adapters that can't route a request. */
export function skipped(request: NotificationRequest, detail: string): DeliveryResult {
  return {
    state: "skipped",
    kind: request.notification.kind,
    target: request.target,
    detail,
  };
}

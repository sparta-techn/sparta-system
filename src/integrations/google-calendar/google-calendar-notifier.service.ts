/**
 * GoogleCalendarNotifierService — Calendar's implementation of {@link NotifierPort}.
 *
 * Calendar is a *narrow* channel: it delivers only `meeting_reminder`
 * notifications, by creating a calendar event with reminder overrides. Every
 * other kind is skipped (pure logic, no client call), demonstrating per-provider
 * capability granularity via `supportedKinds`. Routes `calendar`/`user` targets.
 */

import {
  skipped,
  type DeliveryResult,
  type MeetingDetails,
  type Notification,
  type NotificationKind,
  type NotificationRequest,
  type NotifierPort,
} from "../ports";
import { GoogleCalendarClient } from "./google-calendar-client";
import type { CalendarEventRequest } from "./types";

/** Default reminders on a created meeting event. */
const DEFAULT_REMINDERS: CalendarEventRequest["reminders"] = [
  { method: "popup", minutesBefore: 10 },
  { method: "email", minutesBefore: 60 },
];

export class GoogleCalendarNotifierService implements NotifierPort {
  /** Calendar only delivers meeting reminders. */
  readonly supportedKinds: readonly NotificationKind[] = ["meeting_reminder"];

  constructor(private readonly client: GoogleCalendarClient) {}

  supports(kind: NotificationKind): boolean {
    return this.supportedKinds.includes(kind);
  }

  async notify(accountId: string, request: NotificationRequest): Promise<DeliveryResult> {
    if (!this.supports(request.notification.kind)) {
      return skipped(request, "Google Calendar delivers only meeting_reminder notifications.");
    }
    if (!request.notification.meeting) {
      return skipped(request, "meeting_reminder requires meeting details (startAt).");
    }

    const calendarId = resolveCalendar(request);
    if (calendarId === null) {
      return skipped(request, "Google Calendar routes only calendar or user targets.");
    }

    const event = toEvent(calendarId, request.notification, request.notification.meeting, request.dedupeKey);
    const response = await this.client.createEvent(accountId, event);
    return {
      state: response.status === "cancelled" ? "failed" : "delivered",
      kind: request.notification.kind,
      target: request.target,
      externalId: response.id,
    };
  }
}

function resolveCalendar(request: NotificationRequest): string | null {
  const { target } = request;
  if (target.type === "calendar" || target.type === "user") return target.ref;
  return null;
}

/** Pure map: neutral notification + meeting details → a Calendar event insert. */
function toEvent(
  calendarId: string,
  notification: Notification,
  meeting: MeetingDetails,
  dedupeKey?: string,
): CalendarEventRequest {
  return {
    calendarId,
    summary: notification.title,
    description: notification.body,
    startAt: meeting.startAt,
    endAt: meeting.endAt,
    location: meeting.location,
    conferenceUrl: meeting.joinUrl,
    attendees: meeting.attendees?.map((email) => ({ email })),
    reminders: DEFAULT_REMINDERS,
    requestId: dedupeKey,
  };
}

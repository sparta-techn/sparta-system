/**
 * Google Calendar domain types — the shapes Calendar *speaks*.
 *
 * A subset of the Calendar API events resource SpartaFlow needs to deliver
 * meeting reminders (create an event with reminder overrides). Vendor-specific
 * counterpart to the neutral notification DTOs in `../ports/notifier.ts`.
 */

export interface CalendarAttendee {
  email: string;
  displayName?: string;
}

export interface CalendarReminderOverride {
  method: "popup" | "email";
  minutesBefore: number;
}

export interface CalendarEventRequest {
  calendarId: string;
  summary: string;
  description?: string;
  /** ISO start instant. */
  startAt: string;
  /** ISO end instant (defaults to start + 30m when omitted, wired later). */
  endAt?: string;
  location?: string;
  attendees?: readonly CalendarAttendee[];
  reminders?: readonly CalendarReminderOverride[];
  /** Video-conference link surfaced on the event. */
  conferenceUrl?: string;
  /** Idempotency: dedupes retried inserts. */
  requestId?: string;
}

export interface CalendarEventResponse {
  id: string;
  htmlLink: string;
  status: "confirmed" | "tentative" | "cancelled";
}

/** Primary calendar identity behind the credential (connect/probe). */
export interface CalendarIdentity {
  calendarId: string;
  timeZone: string;
}

export interface GoogleCalendarClientConfig {
  apiBaseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}

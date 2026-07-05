/**
 * GoogleCalendarClient — the single HTTP/SDK seam for Google Calendar.
 *
 * The ONLY file that will import a Google SDK or issue HTTP (Architecture doc
 * §4/§9). STATUS: architecture only — every method resolves to `notImplemented`,
 * so no Calendar API is contacted. Wiring means filling these bodies (resolve a
 * token, `events.insert`, read the primary calendar) and flipping
 * `available: true`.
 */

import { notImplemented } from "../services/errors";
import type {
  CalendarEventRequest,
  CalendarEventResponse,
  CalendarIdentity,
  GoogleCalendarClientConfig,
} from "./types";

const DEFAULT_API_BASE_URL = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarClient {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: GoogleCalendarClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  /** Primary calendar identity behind the credential (connect/probe). */
  async getPrimaryCalendar(accountId: string): Promise<CalendarIdentity> {
    return notImplemented(`GoogleCalendarClient.getPrimaryCalendar (account ${accountId})`);
  }

  /** `events.insert` — create a calendar event (used for meeting reminders). */
  async createEvent(
    accountId: string,
    request: CalendarEventRequest,
  ): Promise<CalendarEventResponse> {
    return notImplemented(`GoogleCalendarClient.createEvent (account ${accountId})`);
  }
}

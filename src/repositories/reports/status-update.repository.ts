import type { ListParams } from "@/services/core";
import {
  StatusUpdatesService,
  statusUpdatesService,
  type StatusUpdateInsert,
  type StatusUpdateRow,
  type StatusUpdateUpdate,
} from "@/services/reports";

/** Payload for a check-in / midday submission (kind is set by the verb). */
export type StatusUpdatePayload = Omit<StatusUpdateInsert, "kind">;

/**
 * StatusUpdateRepository — Morning Check-in and Midday Status over
 * `public.daily_status_updates` (migration 20260630130000). Delegates to
 * {@link StatusUpdatesService}; one row per `(user_id, work_date, kind)`.
 */
export class StatusUpdateRepository {
  constructor(private readonly service: StatusUpdatesService = statusUpdatesService) {}

  // ── Morning Check-in ────────────────────────────────────────────────────────

  /** Submit (or re-submit) the morning check-in for a work date. */
  submitCheckin(payload: StatusUpdatePayload): Promise<StatusUpdateRow> {
    return this.service.submit({ ...payload, kind: "morning_checkin" });
  }

  /** The morning check-in for a user on a work date, if any. */
  getCheckin(userId: string, workDate: string): Promise<StatusUpdateRow | null> {
    return this.service.getByKind(userId, workDate, "morning_checkin");
  }

  // ── Midday Status ───────────────────────────────────────────────────────────

  /** Submit (or re-submit) the midday status for a work date. */
  submitMidday(payload: StatusUpdatePayload): Promise<StatusUpdateRow> {
    return this.service.submit({ ...payload, kind: "midday" });
  }

  /** The midday status for a user on a work date, if any. */
  getMidday(userId: string, workDate: string): Promise<StatusUpdateRow | null> {
    return this.service.getByKind(userId, workDate, "midday");
  }

  // ── Shared ──────────────────────────────────────────────────────────────────

  /** Patch an existing status update within its edit window. */
  update(id: string, patch: StatusUpdateUpdate): Promise<StatusUpdateRow> {
    return this.service.update(id, patch);
  }

  /** All morning check-ins for a work date (manager roll-up). */
  listCheckinsByDate(
    workDate: string,
    params: ListParams<StatusUpdateRow> = {},
  ): Promise<StatusUpdateRow[]> {
    return this.service.listByDate(workDate, "morning_checkin", params);
  }

  /** All midday statuses for a work date (manager roll-up). */
  listMiddayByDate(
    workDate: string,
    params: ListParams<StatusUpdateRow> = {},
  ): Promise<StatusUpdateRow[]> {
    return this.service.listByDate(workDate, "midday", params);
  }

  /** A user's status updates (most recent first). */
  listByUser(userId: string, params: ListParams<StatusUpdateRow> = {}): Promise<StatusUpdateRow[]> {
    return this.service.listByUser(userId, params);
  }
}

/** Shared singleton — import this, not the class. */
export const statusUpdateRepository = new StatusUpdateRepository();

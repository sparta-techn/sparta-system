import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";
import { resolveSubmissionMode } from "./rules";
import type {
  StatusUpdateInsert,
  StatusUpdateKind,
  StatusUpdateRow,
  StatusUpdateUpdate,
} from "./types";

/**
 * StatusUpdatesService — intraday status pulses (`public.daily_status_updates`).
 *
 * Backs both the **Morning Check-in** (`kind='morning_checkin'`) and the
 * **Midday Status** (`kind='midday'`). One row per `(user_id, work_date, kind)`;
 * `submit` is idempotent on that key.
 */
export class StatusUpdatesService extends BaseService<
  StatusUpdateRow,
  StatusUpdateInsert,
  StatusUpdateUpdate
> {
  protected readonly table = "daily_status_updates";
  protected readonly entity = "Status update";
  protected readonly defaultOrderBy = "work_date";

  /** The status update of a given kind for a user on a work date, or `null`. */
  async getByKind(
    userId: string,
    workDate: string,
    kind: StatusUpdateKind,
  ): Promise<StatusUpdateRow | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .eq("user_id", userId)
        .eq("work_date", workDate)
        .eq("kind", kind)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as StatusUpdateRow | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Submit (or re-submit) a status update of a kind — one per `(user, date, kind)`. */
  async submit(input: StatusUpdateInsert): Promise<StatusUpdateRow> {
    const kind: StatusUpdateKind = input.kind ?? "morning_checkin";
    const existing = await this.getByKind(input.user_id, input.work_date, kind);
    const payload = { ...input, kind, submitted_at: new Date().toISOString() };
    return resolveSubmissionMode(existing) === "update"
      ? this.update(existing!.id, payload)
      : this.create(payload);
  }

  /** A user's status updates (most recent first), optionally filtered by kind. */
  listByUser(userId: string, params: ListParams<StatusUpdateRow> = {}): Promise<StatusUpdateRow[]> {
    return this.list({ ...params, filters: { ...params.filters, user_id: userId } });
  }

  /** All status updates of a kind for a work date (manager roll-up). */
  listByDate(
    workDate: string,
    kind: StatusUpdateKind,
    params: ListParams<StatusUpdateRow> = {},
  ): Promise<StatusUpdateRow[]> {
    return this.list({ ...params, filters: { ...params.filters, work_date: workDate, kind } });
  }

  /**
   * Submitted status pulses across the team, most recent first — the manager
   * review queue. "Submitted" = `submitted_at IS NOT NULL` (there is no status
   * column on this table). RLS scopes the rows a reviewer may see.
   */
  async listSubmitted(limit = 100): Promise<StatusUpdateRow[]> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select("*")
        .not("submitted_at", "is", null)
        .order("work_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as StatusUpdateRow[]) ?? [];
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const statusUpdatesService = new StatusUpdatesService();

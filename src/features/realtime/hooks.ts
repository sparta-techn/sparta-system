/**
 * Per-domain Realtime hooks.
 *
 * Each hook scopes a subscription to *relevant rows only* (a filter on the
 * signed-in user, a project, a parent entity, …) and auto-unsubscribes on
 * unmount via {@link useRealtimeSubscription}. Handlers receive the raw
 * `postgres_changes` payload plus optional `onResync` (fired after a reconnect
 * so you can refetch) and `onStatus` callbacks.
 *
 * Dormant-until-published: `tasks` and `comments` tables don't exist yet, so
 * their hooks are gated by {@link isRealtimeEnabled} — they compile and can be
 * mounted today, but stay inert until those tables join the publication. Every
 * other domain is live (migration 20260701130000).
 */
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRealtimeSubscription, type RealtimeStatus } from "@/hooks/use-realtime";
import { isRealtimeEnabled, type PostgresEvent } from "@/lib/supabase/realtime";

/** A change handler plus optional reconnect / status hooks. */
export interface DomainHandlers<Row extends Record<string, unknown>> {
  onChange: (payload: RealtimePostgresChangesPayload<Row>) => void;
  onResync?: () => void;
  onStatus?: (status: RealtimeStatus) => void;
}

type Id = string | null | undefined;

/** Shared wiring: subscribe to `table` scoped by `filter`, gated on publication + scope. */
function useDomainRealtime<Row extends Record<string, unknown>>(
  table: string,
  filter: string | undefined,
  handlers: DomainHandlers<Row>,
  opts: { event?: PostgresEvent; requireScope?: boolean } = {},
): void {
  const { event = "*", requireScope = true } = opts;
  const scoped = !requireScope || !!filter;
  useRealtimeSubscription<Row>(
    scoped
      ? {
          table,
          event,
          filter,
          onChange: handlers.onChange,
          onResync: handlers.onResync,
          onStatus: handlers.onStatus,
          enabled: isRealtimeEnabled(table),
        }
      : null,
  );
}

// ── 1. Notifications ────────────────────────────────────────────────────────
/** New / updated notifications for a recipient. */
export function useNotificationsRealtime<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(recipientId: Id, handlers: DomainHandlers<Row>): void {
  useDomainRealtime(
    "notifications",
    recipientId ? `recipient_id=eq.${recipientId}` : undefined,
    handlers,
  );
}

// ── 2. Task updates ──────────────────────────────────────────── (dormant) ──
/** Task changes within a project. Inert until the `tasks` table is published. */
export function useTaskRealtime<Row extends Record<string, unknown> = Record<string, unknown>>(
  projectId: Id,
  handlers: DomainHandlers<Row>,
): void {
  useDomainRealtime("tasks", projectId ? `project_id=eq.${projectId}` : undefined, handlers);
}

// ── 3. Task assignments ─────────────────────────────────────── (dormant) ──
/** Tasks (re)assigned to a user. Inert until the `tasks` table is published. */
export function useTaskAssignmentRealtime<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(assigneeId: Id, handlers: DomainHandlers<Row>): void {
  useDomainRealtime("tasks", assigneeId ? `assignee_id=eq.${assigneeId}` : undefined, handlers);
}

// ── 4. Comments ─────────────────────────────────────────────── (dormant) ──
/** Comments on a parent entity. Inert until the `comments` table is published. */
export function useCommentsRealtime<Row extends Record<string, unknown> = Record<string, unknown>>(
  parentId: Id,
  handlers: DomainHandlers<Row>,
): void {
  useDomainRealtime("comments", parentId ? `parent_id=eq.${parentId}` : undefined, handlers);
}

// ── 5. Mentions ───────────────────────────────────────────────────────────
/** New mentions of a user. */
export function useMentionsRealtime<Row extends Record<string, unknown> = Record<string, unknown>>(
  userId: Id,
  handlers: DomainHandlers<Row>,
): void {
  useDomainRealtime("mentions", userId ? `mentioned_user_id=eq.${userId}` : undefined, handlers, {
    event: "INSERT",
  });
}

// ── 6. Daily reports ──────────────────────────────────────────────────────
/**
 * Daily report + status-update changes. Filters by `user_id` when given (my
 * own reports); pass `null`/omit for team-wide reviewers (RLS still scopes).
 */
export function useDailyReportsRealtime<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(userId: Id, handlers: DomainHandlers<Row>, opts: { teamWide?: boolean } = {}): void {
  const filter = userId ? `user_id=eq.${userId}` : undefined;
  const requireScope = !opts.teamWide;
  useDomainRealtime("daily_reports", filter, handlers, { requireScope });
  useDomainRealtime("daily_status_updates", filter, handlers, { requireScope });
}

// ── 7. Attendance ─────────────────────────────────────────────────────────
/** Attendance changes for a user (pass `teamWide` for a team dashboard). */
export function useAttendanceRealtime<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(userId: Id, handlers: DomainHandlers<Row>, opts: { teamWide?: boolean } = {}): void {
  useDomainRealtime("attendance", userId ? `user_id=eq.${userId}` : undefined, handlers, {
    requireScope: !opts.teamWide,
  });
}

// ── 8. Dependency requests ─────────────────────────────────────────────────
/**
 * Dependency-request changes. Optionally scope with a raw `filter`
 * (e.g. `to_project_id=eq.<uuid>`); omit for a board-wide view (RLS scopes).
 */
export function useDependencyRealtime<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(handlers: DomainHandlers<Row>, opts: { filter?: string } = {}): void {
  useDomainRealtime("dependency_requests", opts.filter, handlers, { requireScope: false });
}

/**
 * RecentActivityPort — the capability port for "recent activity" feeds.
 *
 * A content/storage provider (Figma, Google Drive, Google Docs, …) exposes a
 * stream of recent events — a file edited, a doc commented on, a design updated.
 * Rather than widen the six-method `Integration` lifecycle, this behaviour is a
 * capability port an adapter *additionally* implements (Architecture doc §5), the
 * same shape as `VcsActivityPort` in `./vcs-activity.ts`.
 *
 * Features resolve this port by capability (`"activity.recent"`) and stay
 * vendor-blind: the SpartaFlow activity feed renders Figma, Drive and Docs events
 * through one interface and never names a vendor.
 *
 * Types only — no adapter here calls a network. Each provider routes its
 * implementation through a `notImplemented` client seam until wired.
 */

/** A person who performed an activity (edited a file, left a comment, …). */
export interface ActivityActor {
  /** Stable provider id for the actor. */
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * The normalized verb of an activity. A closed, provider-neutral set; adapters
 * map their own event taxonomy onto it (unknown vendor events fold to `edited`).
 */
export type ActivityAction =
  | "created"
  | "edited"
  | "commented"
  | "shared"
  | "renamed"
  | "moved"
  | "deleted"
  | "restored"
  | "viewed";

/** The thing an activity happened to — a file, document, design, folder. */
export interface ActivityResource {
  /** Provider id of the resource (file key, document id, …). */
  id: string;
  /** Neutral resource type tag, e.g. "document", "design", "file", "folder". */
  type: string;
  name: string;
  url?: string;
}

/** One normalized activity event. */
export interface ActivityItem {
  id: string;
  action: ActivityAction;
  actor: ActivityActor;
  resource: ActivityResource;
  /** ISO timestamp the event occurred. */
  occurredAt: string;
  /** Optional human-readable one-liner (e.g. "renamed Q3 Plan → Q3 Roadmap"). */
  summary?: string;
}

/** Forward-only, cursor-based pagination — provider-agnostic. */
export interface ActivityPageParams {
  /** Cursor from the previous page's `nextCursor`; absent = most recent page. */
  cursor?: string;
  /** Requested page size; the provider may clamp it. */
  perPage?: number;
  /** ISO lower bound — only return activity at or after this instant. */
  since?: string;
}

/** One page of activity plus the cursor to fetch older events. */
export interface ActivityPage<T> {
  items: readonly T[];
  /** Absent when there are no further pages. */
  nextCursor?: string;
}

/**
 * Read-only recent-activity feed for one connected account. Scoped by
 * `accountId` so a single adapter instance serves many connected accounts.
 */
export interface RecentActivityPort {
  listRecentActivity(
    accountId: string,
    params?: ActivityPageParams,
  ): Promise<ActivityPage<ActivityItem>>;
}

/** Structural guard: does an adapter implement the recent-activity port? */
export function isRecentActivityPort(value: unknown): value is RecentActivityPort {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Record<string, unknown>).listRecentActivity === "function";
}

/**
 * Figma domain types — the shapes Figma *speaks*.
 *
 * A subset of the Figma REST / webhook payloads SpartaFlow reads for a recent
 * design-activity feed. The vendor-specific counterpart to the neutral
 * `Activity*` DTOs in `../ports/recent-activity.ts`: the client returns these and
 * `figma-recent-activity.service.ts` maps them onto the neutral port shapes.
 */

/** Figma user (file author, comment author, version editor). */
export interface FigmaUser {
  id: string;
  handle: string;
  email?: string;
  imgUrl?: string;
}

/** The file an event touched. */
export interface FigmaFileRef {
  key: string;
  name: string;
}

/** The Figma event kinds SpartaFlow surfaces as activity. */
export type FigmaEventType =
  | "FILE_UPDATE"
  | "FILE_VERSION_UPDATE"
  | "FILE_COMMENT"
  | "FILE_DELETE"
  | "LIBRARY_PUBLISH";

export interface FigmaActivityEvent {
  id: string;
  eventType: FigmaEventType;
  file: FigmaFileRef;
  triggeredBy: FigmaUser;
  /** ISO timestamp. */
  timestamp: string;
  /** Present for FILE_COMMENT events. */
  commentText?: string;
}

/** Page-of-events shape, using Figma's opaque cursor. */
export interface FigmaPage<T> {
  items: readonly T[];
  cursor?: string;
}

/** Options for a recent-activity read. */
export interface FigmaActivityOptions {
  cursor?: string;
  pageSize?: number;
  since?: string;
  /** Restrict to a Figma team (mirrors the `teamId` setting). */
  teamId?: string;
}

/**
 * Adapter configuration. `resolveToken` decrypts the account credential into a
 * bearer token; never invoked today (every client call short-circuits at
 * `notImplemented`).
 */
export interface FigmaClientConfig {
  apiBaseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}

/**
 * Google Docs domain types — the shapes Docs *speaks*.
 *
 * A subset of the Docs / Drive-revisions payloads SpartaFlow reads for a recent
 * document-activity feed. Vendor-specific counterpart to the neutral `Activity*`
 * DTOs in `../ports/recent-activity.ts`.
 */

/** A Docs actor (person who edited, suggested or commented on a document). */
export interface DocsUser {
  id: string;
  displayName: string;
  emailAddress?: string;
  photoLink?: string;
}

/** The Docs action kinds SpartaFlow surfaces. */
export type DocsActionType = "create" | "edit" | "suggest" | "comment" | "rename";

export interface DocsActivityEvent {
  /** Synthesised stable id (e.g. `${documentId}:${revisionId}`). */
  id: string;
  documentId: string;
  documentTitle: string;
  /** Drive revision id the event corresponds to, when available. */
  revisionId?: string;
  action: DocsActionType;
  actor: DocsUser;
  /** ISO timestamp. */
  timestamp: string;
}

export interface DocsPage<T> {
  items: readonly T[];
  pageToken?: string;
}

export interface DocsActivityOptions {
  pageToken?: string;
  pageSize?: number;
  since?: string;
  /** Limit to a single document (mirrors the `documentId` setting). */
  documentId?: string;
}

export interface GoogleDocsClientConfig {
  apiBaseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}

/**
 * Google Drive domain types — the shapes Drive *speaks*.
 *
 * A subset of the Drive Activity API payloads SpartaFlow reads for a recent
 * file-activity feed. Vendor-specific counterpart to the neutral `Activity*` DTOs
 * in `../ports/recent-activity.ts`.
 */

/** A Drive actor (person who created/edited/shared a file). */
export interface DriveUser {
  /** Drive permission id or people-api id. */
  id: string;
  displayName: string;
  emailAddress?: string;
  photoLink?: string;
}

/** The file/folder an activity targeted. */
export interface DriveFileTarget {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

/** The Drive action kinds SpartaFlow surfaces. */
export type DriveActionType =
  | "create"
  | "edit"
  | "comment"
  | "rename"
  | "move"
  | "delete"
  | "restore"
  | "permissionChange";

export interface DriveActivityEvent {
  /** Synthesised stable id (Drive activity has no native id). */
  id: string;
  action: DriveActionType;
  actor: DriveUser;
  target: DriveFileTarget;
  /** ISO timestamp. */
  timestamp: string;
}

export interface DrivePage<T> {
  items: readonly T[];
  pageToken?: string;
}

export interface DriveActivityOptions {
  pageToken?: string;
  pageSize?: number;
  since?: string;
  /** Restrict to a folder subtree (mirrors the `folderId` setting). */
  folderId?: string;
}

export interface GoogleDriveClientConfig {
  apiBaseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}

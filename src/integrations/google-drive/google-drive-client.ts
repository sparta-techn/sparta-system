/**
 * GoogleDriveClient — the single HTTP/SDK seam for Google Drive.
 *
 * The ONLY file that will import a Google SDK or issue HTTP (Architecture doc
 * §4/§9). STATUS: architecture only — every method resolves to `notImplemented`,
 * so no Drive API is contacted. Wiring means filling these bodies (resolve a
 * token, call the Drive Activity API, map to the `Drive*` DTOs) and flipping
 * `available: true`.
 */

import { notImplemented } from "../services/errors";
import type {
  DriveActivityEvent,
  DriveActivityOptions,
  DrivePage,
  DriveUser,
  GoogleDriveClientConfig,
} from "./types";

const DEFAULT_API_BASE_URL = "https://driveactivity.googleapis.com";

export class GoogleDriveClient {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: GoogleDriveClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  /** Identity behind an account's credential — used by `authenticate`/`probe`. */
  async getAuthenticatedUser(accountId: string): Promise<DriveUser> {
    return notImplemented(`GoogleDriveClient.getAuthenticatedUser (account ${accountId})`);
  }

  /** Recent Drive activity (creates, edits, comments, shares) for the account. */
  async listActivity(
    accountId: string,
    options?: DriveActivityOptions,
  ): Promise<DrivePage<DriveActivityEvent>> {
    return notImplemented(`GoogleDriveClient.listActivity (account ${accountId})`);
  }
}

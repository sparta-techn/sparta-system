/**
 * GoogleDocsClient — the single HTTP/SDK seam for Google Docs.
 *
 * The ONLY file that will import a Google SDK or issue HTTP (Architecture doc
 * §4/§9). STATUS: architecture only — every method resolves to `notImplemented`.
 * Docs has no direct activity endpoint, so the real body will read document
 * revisions (via the Drive revisions API) and map them to the `Docs*` DTOs.
 */

import { notImplemented } from "../services/errors";
import type {
  DocsActivityEvent,
  DocsActivityOptions,
  DocsPage,
  DocsUser,
  GoogleDocsClientConfig,
} from "./types";

const DEFAULT_API_BASE_URL = "https://docs.googleapis.com";

export class GoogleDocsClient {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: GoogleDocsClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  /** Identity behind an account's credential — used by `authenticate`/`probe`. */
  async getAuthenticatedUser(accountId: string): Promise<DocsUser> {
    return notImplemented(`GoogleDocsClient.getAuthenticatedUser (account ${accountId})`);
  }

  /** Recent document activity (edits, suggestions, comments) for the account. */
  async listActivity(
    accountId: string,
    options?: DocsActivityOptions,
  ): Promise<DocsPage<DocsActivityEvent>> {
    return notImplemented(`GoogleDocsClient.listActivity (account ${accountId})`);
  }
}

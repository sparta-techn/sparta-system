/**
 * FigmaClient — the single HTTP/SDK seam for Figma.
 *
 * The ONLY file that will import a Figma SDK or issue HTTP (per Architecture doc
 * §4/§9). Feature code depends on this class, never on `fetch` directly.
 *
 * STATUS: architecture only — every method resolves to `notImplemented`, so no
 * Figma API is contacted. Wiring the real integration means filling these bodies
 * (resolve a token via `config.resolveToken`, call the API, map to the `Figma*`
 * DTOs) and flipping `available: true`. Nothing else changes.
 */

import { notImplemented } from "../services/errors";
import type {
  FigmaActivityEvent,
  FigmaActivityOptions,
  FigmaClientConfig,
  FigmaPage,
  FigmaUser,
} from "./types";

const DEFAULT_API_BASE_URL = "https://api.figma.com";

export class FigmaClient {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: FigmaClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  /** Identity behind an account's credential — used by `authenticate`/`probe`. */
  async getAuthenticatedUser(accountId: string): Promise<FigmaUser> {
    return notImplemented(`FigmaClient.getAuthenticatedUser (account ${accountId})`);
  }

  /** Recent design activity (file updates, versions, comments) for the account. */
  async listActivity(
    accountId: string,
    options?: FigmaActivityOptions,
  ): Promise<FigmaPage<FigmaActivityEvent>> {
    return notImplemented(`FigmaClient.listActivity (account ${accountId})`);
  }
}

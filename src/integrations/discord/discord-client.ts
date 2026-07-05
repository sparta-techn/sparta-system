/**
 * DiscordClient — the single HTTP/SDK seam for Discord.
 *
 * The ONLY file that will import a Discord SDK or issue HTTP (Architecture doc
 * §4/§9). STATUS: architecture only — every method resolves to `notImplemented`,
 * so no Discord API is contacted. Wiring means filling these bodies (resolve a
 * bot token, `POST /channels/{id}/messages`, `GET /users/@me`) and flipping
 * `available: true`.
 */

import { notImplemented } from "../services/errors";
import type {
  DiscordClientConfig,
  DiscordCreateMessageRequest,
  DiscordIdentity,
  DiscordMessageResponse,
} from "./types";

const DEFAULT_API_BASE_URL = "https://discord.com/api/v10";

export class DiscordClient {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: DiscordClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  /** `GET /users/@me` — bot identity behind the token (connect/probe). */
  async getBotIdentity(accountId: string): Promise<DiscordIdentity> {
    return notImplemented(`DiscordClient.getBotIdentity (account ${accountId})`);
  }

  /** `POST /channels/{id}/messages` — post a notification embed. */
  async createMessage(
    accountId: string,
    request: DiscordCreateMessageRequest,
  ): Promise<DiscordMessageResponse> {
    return notImplemented(`DiscordClient.createMessage (account ${accountId})`);
  }
}

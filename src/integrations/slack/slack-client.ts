/**
 * SlackClient — the single HTTP/SDK seam for Slack.
 *
 * The ONLY file that will import the Slack SDK or issue HTTP (Architecture doc
 * §4/§9). STATUS: architecture only — every method resolves to `notImplemented`,
 * so no Slack API is contacted. Wiring means filling these bodies (resolve a
 * token via `config.resolveToken`, call `chat.postMessage` / `auth.test`) and
 * flipping `available: true`.
 */

import { notImplemented } from "../services/errors";
import type {
  SlackClientConfig,
  SlackIdentity,
  SlackPostMessageRequest,
  SlackPostMessageResponse,
} from "./types";

const DEFAULT_API_BASE_URL = "https://slack.com/api";

export class SlackClient {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: SlackClientConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  /** `auth.test` — team identity behind the credential (connect/probe). */
  async authTest(accountId: string): Promise<SlackIdentity> {
    return notImplemented(`SlackClient.authTest (account ${accountId})`);
  }

  /** `chat.postMessage` — post a notification to a channel or DM. */
  async postMessage(
    accountId: string,
    request: SlackPostMessageRequest,
  ): Promise<SlackPostMessageResponse> {
    return notImplemented(`SlackClient.postMessage (account ${accountId})`);
  }
}

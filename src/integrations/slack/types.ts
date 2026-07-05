/**
 * Slack domain types — the shapes Slack *speaks*.
 *
 * A subset of the Slack Web API (`chat.postMessage`) payloads SpartaFlow needs to
 * post notifications. Vendor-specific counterpart to the neutral notification
 * DTOs in `../ports/notifier.ts`.
 */

/** Minimal Block Kit block (SpartaFlow only builds section/actions blocks). */
export interface SlackBlock {
  type: "section" | "actions" | "context" | "header";
  text?: { type: "mrkdwn" | "plain_text"; text: string };
  elements?: readonly SlackBlockElement[];
}

/** A Block Kit button element (used for approval actions). */
export interface SlackBlockElement {
  type: "button";
  text: { type: "plain_text"; text: string };
  actionId: string;
  url?: string;
  style?: "primary" | "danger";
}

export interface SlackPostMessageRequest {
  /** Channel id or user id (a DM opens automatically for a user id). */
  channel: string;
  /** Fallback/notification text. */
  text: string;
  blocks?: readonly SlackBlock[];
}

export interface SlackPostMessageResponse {
  ok: boolean;
  /** Message timestamp — Slack's message id. */
  ts: string;
  channel: string;
}

/** Team identity behind a credential — returned by `auth.test`. */
export interface SlackIdentity {
  teamId: string;
  teamName: string;
  botUserId: string;
}

export interface SlackClientConfig {
  apiBaseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}

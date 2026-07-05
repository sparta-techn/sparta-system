/**
 * Discord domain types — the shapes Discord *speaks*.
 *
 * A subset of the Discord "create message" payload SpartaFlow needs to post
 * notifications (rich embeds + link buttons). Vendor-specific counterpart to the
 * neutral notification DTOs in `../ports/notifier.ts`.
 */

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  /** Integer color, e.g. red for urgent. */
  color?: number;
  fields?: readonly DiscordEmbedField[];
  /** ISO timestamp shown in the embed footer. */
  timestamp?: string;
}

/** A link-style button component (Discord action row). */
export interface DiscordLinkButton {
  label: string;
  url: string;
}

export interface DiscordCreateMessageRequest {
  channelId: string;
  content?: string;
  embeds?: readonly DiscordEmbed[];
  buttons?: readonly DiscordLinkButton[];
}

export interface DiscordMessageResponse {
  id: string;
  channelId: string;
}

/** Bot identity behind a token — returned by `GET /users/@me`. */
export interface DiscordIdentity {
  botuserId: string;
  username: string;
}

export interface DiscordClientConfig {
  apiBaseUrl?: string;
  resolveToken?: (accountId: string) => Promise<string>;
}

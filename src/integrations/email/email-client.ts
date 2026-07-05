/**
 * EmailClient — the single transport seam for email.
 *
 * The ONLY file that will open an SMTP connection or call an email-provider API
 * (Architecture doc §4/§9). STATUS: architecture only — every method resolves to
 * `notImplemented`, so no mail is sent. Wiring means filling these bodies
 * (resolve the SMTP/API credential, send, verify the sender) and flipping
 * `available: true`.
 */

import { notImplemented } from "../services/errors";
import type {
  EmailClientConfig,
  EmailSenderIdentity,
  EmailSendRequest,
  EmailSendResponse,
} from "./types";

export class EmailClient {
  constructor(private readonly config: EmailClientConfig = {}) {}

  /** Confirm the configured sender is authorized (connect/probe). */
  async verifySender(accountId: string): Promise<EmailSenderIdentity> {
    return notImplemented(`EmailClient.verifySender (account ${accountId})`);
  }

  /** Deliver one email through the configured transport. */
  async send(accountId: string, request: EmailSendRequest): Promise<EmailSendResponse> {
    return notImplemented(`EmailClient.send (account ${accountId})`);
  }
}

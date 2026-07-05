/**
 * Email domain types — the shapes the email channel *speaks*.
 *
 * Provider-neutral over the transport (SMTP or an email API such as SES /
 * SendGrid / Postmark): SpartaFlow builds a `EmailSendRequest`, the client seam
 * hides which transport delivers it. Vendor-specific counterpart to the neutral
 * notification DTOs in `../ports/notifier.ts`.
 */

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailSendRequest {
  to: readonly EmailAddress[];
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text fallback. */
  text?: string;
  replyTo?: EmailAddress;
  /** Idempotency key forwarded to the transport when supported. */
  idempotencyKey?: string;
}

export interface EmailSendResponse {
  /** Transport message id. */
  messageId: string;
  accepted: readonly string[];
  rejected: readonly string[];
}

/** Verified sender identity behind the credential (connect/probe). */
export interface EmailSenderIdentity {
  fromAddress: string;
  verified: boolean;
}

export interface EmailClientConfig {
  /** SMTP host or API base, depending on transport. */
  endpoint?: string;
  resolveCredential?: (accountId: string) => Promise<string>;
}

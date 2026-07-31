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
  /** The sender's domain — what the provider actually authorizes. */
  domain: string;
  verified: boolean;
  /**
   * Whether the provider knows this domain at all. `false` means it was never
   * added — a different, more actionable failure than "added but still pending".
   */
  known: boolean;
  /** Provider's raw status (Resend: `pending` | `verified` | `failed` | …). */
  status?: string;
}

export interface EmailClientConfig {
  /** SMTP host or API base, depending on transport. Defaults to the Resend API. */
  endpoint?: string;
  /**
   * Static API credential. Server-side callers pass the resolved secret here
   * (see `resend.server.ts`) — this module never reads `process.env` itself, so
   * importing it can never pull a secret into the browser bundle.
   */
  apiKey?: string;
  /** Per-account credential lookup, preferred over {@link apiKey} when present. */
  resolveCredential?: (accountId: string) => Promise<string>;
  /** Verified sender every message goes out as (e.g. `SpartaFlow <hr@spartaflow.com>`). */
  from?: EmailAddress;
}

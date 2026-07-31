/**
 * EmailClient — the single transport seam for email.
 *
 * The ONLY file that calls an email-provider API (Architecture doc §4/§9).
 * Wired to **Resend's REST API** directly — deliberately NOT through Supabase
 * Auth's SMTP, which GoTrue reserves for its invite / signup / recovery
 * templates and cannot send arbitrary transactional mail like a payslip.
 *
 * Credential-agnostic by construction: the key arrives through
 * {@link EmailClientConfig} and this file never touches `process.env`, so it
 * stays safe to import from isomorphic code. Server callers build a configured
 * instance via `resend.server.ts`.
 */

import { IntegrationError } from "../services/errors";
import type {
  EmailAddress,
  EmailClientConfig,
  EmailSenderIdentity,
  EmailSendRequest,
  EmailSendResponse,
} from "./types";

const RESEND_API = "https://api.resend.com";

/** `Name <a@b.com>` when a name is present, bare address otherwise. */
function formatAddress(a: EmailAddress): string {
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

interface ResendErrorBody {
  name?: string;
  message?: string;
  statusCode?: number;
}

/** Map a Resend HTTP failure onto the integration error contract. */
function transportError(status: number, body: ResendErrorBody | null): IntegrationError {
  const detail = body?.message || body?.name || `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new IntegrationError(
      "unauthorized",
      `Resend rejected the API key (${detail}). Check RESEND_API_KEY.`,
    );
  }
  if (status === 400 || status === 422) {
    return new IntegrationError("invalid_request", `Resend rejected the message: ${detail}`);
  }
  if (status === 429) {
    return new IntegrationError("rate_limited", `Resend rate-limited the send: ${detail}`);
  }
  return new IntegrationError("provider_unavailable", `Resend could not send the email: ${detail}`);
}

export class EmailClient {
  constructor(private readonly config: EmailClientConfig = {}) {}

  private get baseUrl(): string {
    return (this.config.endpoint ?? RESEND_API).replace(/\/+$/, "");
  }

  /** The account's API key, from the per-account resolver or the static config. */
  private async credential(accountId: string): Promise<string> {
    const key = this.config.resolveCredential
      ? await this.config.resolveCredential(accountId)
      : this.config.apiKey;
    if (!key) {
      throw new IntegrationError(
        "not_connected",
        "No email API key is configured. Set RESEND_API_KEY in the server environment (see docs/ENVIRONMENT.md).",
      );
    }
    return key;
  }

  private async request<T>(accountId: string, path: string, init: RequestInit = {}): Promise<T> {
    const key = await this.credential(accountId);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch (cause) {
      // A network-level failure is never swallowed — otherwise a payslip gets
      // recorded as sent when nothing left the building.
      throw new IntegrationError("provider_unavailable", "Could not reach Resend.", { cause });
    }

    const body = (await response.json().catch(() => null)) as T | ResendErrorBody | null;
    if (!response.ok) throw transportError(response.status, body as ResendErrorBody | null);
    return body as T;
  }

  /**
   * Confirm the configured sender's domain is verified with Resend. Worth
   * calling before a first real send: Resend accepts a request for an
   * unverified domain and only then fails delivery — exactly the
   * "reported sent, never arrived" failure mode.
   */
  async verifySender(accountId: string): Promise<EmailSenderIdentity> {
    const from = this.config.from;
    if (!from) {
      throw new IntegrationError("not_connected", "No sender address is configured.");
    }
    const domain = from.address.split("@")[1]?.toLowerCase() ?? "";
    const body = await this.request<{ data?: Array<{ name?: string; status?: string }> }>(
      accountId,
      "/domains",
      { method: "GET" },
    );
    const match = (body?.data ?? []).find((d) => d.name?.toLowerCase() === domain);
    return {
      fromAddress: from.address,
      domain,
      known: match !== undefined,
      status: match?.status,
      verified: match?.status === "verified",
    };
  }

  /** Deliver one email through Resend. */
  async send(accountId: string, request: EmailSendRequest): Promise<EmailSendResponse> {
    const from = this.config.from;
    if (!from) {
      throw new IntegrationError(
        "not_connected",
        "No sender address is configured. Set PAYROLL_EMAIL_FROM in the server environment.",
      );
    }
    const to = request.to.map((a) => a.address);
    if (to.length === 0) {
      throw new IntegrationError("invalid_request", "An email needs at least one recipient.");
    }

    const result = await this.request<{ id?: string }>(accountId, "/emails", {
      method: "POST",
      headers: request.idempotencyKey
        ? // Resend de-duplicates an identical key for 24h, so a double-submit
          // returns the ORIGINAL message id instead of sending a second email.
          { "Idempotency-Key": request.idempotencyKey }
        : {},
      body: JSON.stringify({
        from: formatAddress(from),
        to,
        subject: request.subject,
        html: request.html,
        ...(request.text ? { text: request.text } : {}),
        ...(request.replyTo ? { reply_to: formatAddress(request.replyTo) } : {}),
      }),
    });

    if (!result?.id) {
      // A 2xx with no id means we cannot prove what was sent — treat it as a
      // failure rather than record a payment notification we can't trace.
      throw new IntegrationError(
        "provider_unavailable",
        "Resend accepted the request but returned no message id.",
      );
    }
    return { messageId: result.id, accepted: to, rejected: [] };
  }
}

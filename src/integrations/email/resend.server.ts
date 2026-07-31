/**
 * Resend credential resolution — SERVER ONLY.
 *
 * The one place `RESEND_API_KEY` is read. Kept out of `email-client.ts` (and out
 * of the barrel `index.ts`) so the transport stays importable from isomorphic
 * code without any chance of the secret reaching the browser bundle. Import
 * this ONLY from a server handler, via `await import(...)`.
 */

import { appLog } from "@/lib/logging";

import { IntegrationError } from "../services/errors";
import { EmailClient } from "./email-client";
import type { EmailAddress } from "./types";

/**
 * Default sender. `spartaflow.com` is the domain already verified in Resend for
 * the invite emails, so `hr@` on it needs no extra verification — Resend
 * authorizes per DOMAIN, not per address. Override with PAYROLL_EMAIL_FROM.
 */
const DEFAULT_FROM: EmailAddress = { address: "hr@spartaflow.com", name: "SpartaFlow HR" };

/**
 * Parse `Name <a@b.com>` or a bare `a@b.com` from the environment.
 * Returns null for an unusable value so the caller can fall back.
 */
function parseFrom(value: string | undefined): EmailAddress | null {
  const raw = value?.trim();
  if (!raw) return null;
  const angled = raw.match(/^(.*?)\s*<([^>]+)>$/);
  const address = (angled ? angled[2] : raw).trim();
  if (!address.includes("@")) return null;
  const name = angled ? angled[1].trim().replace(/^"|"$/g, "") : "";
  return name ? { address, name } : { address };
}

/** The configured payslip sender (env override, else {@link DEFAULT_FROM}). */
export function payslipSender(): EmailAddress {
  return parseFrom(process.env.PAYROLL_EMAIL_FROM) ?? DEFAULT_FROM;
}

/**
 * A ready-to-send client backed by the org's Resend key. Throws a clear,
 * actionable error when the key is absent rather than failing at send time.
 */
export function resendEmailClient(): EmailClient {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new IntegrationError(
      "not_connected",
      "RESEND_API_KEY is not set in the server environment, so no email can be sent (see docs/ENVIRONMENT.md).",
    );
  }
  return new EmailClient({ apiKey, from: payslipSender() });
}

/** Whether email sending is configured at all — for a pre-flight UI check. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

// ── Sender pre-flight ────────────────────────────────────────────────────────

/**
 * Positive verification, memoized. A domain that is verified does not become
 * unverified moments later, so re-probing on every send would just add an API
 * round-trip to every payslip. Only SUCCESS is cached — a pending domain is
 * re-checked each time so the operator sees it flip the moment DNS lands.
 */
let verifiedSender: { address: string; at: number } | null = null;
const VERIFY_TTL_MS = 15 * 60_000;

/** Drop the memo — for tests, and after a sender/credential change. */
export function resetSenderVerification(): void {
  verifiedSender = null;
}

/**
 * Refuse to send unless Resend actually authorizes the sender's domain.
 *
 * Why this exists: Resend **accepts** a send for an unverified domain and only
 * then fails delivery, so without this check a payslip would be recorded as
 * sent — with a real message id — and never arrive. That is the worst failure
 * mode here, because `payslip_deliveries` would then suppress the retry.
 *
 * Fail-closed on a definitive "no": the domain is unknown to Resend, or known
 * and not verified.
 *
 * Fail-OPEN on an inconclusive probe (401/403/network/rate-limit). Resend
 * supports sending-only API keys that cannot read `/domains`, and blocking
 * payroll because a perfectly valid key lacks a *read* scope would be worse
 * than the problem being solved. When the probe is inconclusive the send
 * proceeds and, if the key is genuinely bad, the send itself fails with the
 * same error a moment later. The skip is logged, never silent.
 */
export async function ensureSenderVerified(client: EmailClient, accountId: string): Promise<void> {
  const from = payslipSender();

  const cached = verifiedSender;
  if (cached && cached.address === from.address && Date.now() - cached.at < VERIFY_TTL_MS) {
    return;
  }

  let identity: Awaited<ReturnType<EmailClient["verifySender"]>>;
  try {
    identity = await client.verifySender(accountId);
  } catch (cause) {
    const code = (cause as IntegrationError)?.code;
    // A missing key/sender is fatal regardless — let it surface.
    if (code === "not_connected") throw cause;

    appLog.warn("Could not confirm the sender domain with Resend; sending anyway", {
      from: from.address,
      code,
      reason: (cause as Error)?.message,
    });
    return;
  }

  if (identity.verified) {
    verifiedSender = { address: from.address, at: Date.now() };
    return;
  }

  throw new IntegrationError(
    "not_connected",
    identity.known
      ? `The sender domain "${identity.domain}" is registered with Resend but not verified (status: ${identity.status ?? "unknown"}). Resend would accept the email and then fail to deliver it, so nothing was sent and no payment was recorded. Finish DNS verification for ${identity.domain} in the Resend dashboard.`
      : `The sender domain "${identity.domain}" is not set up in Resend, so ${from.address} cannot send. Nothing was sent and no payment was recorded. Add and verify ${identity.domain} in Resend, or point PAYROLL_EMAIL_FROM at an already-verified domain.`,
  );
}

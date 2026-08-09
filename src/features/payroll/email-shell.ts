/**
 * The branded chrome every SpartaFlow transactional email sits inside — header
 * (logo + company name), the rounded card, and the "sent by" footer.
 *
 * Extracted from `rewards/reward-email.ts` so a second sender (HR broadcasts)
 * inherits the branding instead of copying it. Callers supply only the card's
 * inner HTML; the colours, spacing, width and footer are decided here, once.
 *
 * PURE and isomorphic, like the templates that use it — no DOM, no I/O, safe on
 * the server. The bidi helpers live here too, because every Arabic-primary
 * template needs them: a Latin-script run inside RTL text must be explicitly
 * isolated or clients mangle its word and digit order.
 */
import {
  EMAIL_COLORS as C,
  EMAIL_FONT as FONT,
  escapeHtml,
  type PayslipCompany,
} from "./payslip-email";

export type EmailCompany = PayslipCompany;

const HAS_ARABIC = /[؀-ۿ]/;

/** LTR-isolate a value for use inside RTL HTML (no-op when it's Arabic). */
export function ltrHtml(value: string): string {
  const escaped = escapeHtml(value);
  return HAS_ARABIC.test(value) ? escaped : `<span dir="ltr">${escaped}</span>`;
}

/** LTR-isolate a value for use inside RTL plain text (U+2066…U+2069). */
export function ltrText(value: string): string {
  return HAS_ARABIC.test(value) ? value : `⁦${value}⁩`;
}

/**
 * The "sent by" line, in both languages.
 *
 * Guards the case where the org running SpartaFlow is itself called SpartaFlow —
 * "Sent by SpartaFlow via SpartaFlow" reads like a bug.
 */
export function senderNotice(company: EmailCompany): { ar: string; en: string } {
  const isSpartaFlow = company.name.trim().toLowerCase() === "spartaflow";
  return {
    en: isSpartaFlow ? `Sent by ${company.name}.` : `Sent by ${company.name} via SpartaFlow.`,
    ar: isSpartaFlow
      ? `أُرسلت هذه الرسالة من ${ltrText(company.name)}.`
      : `أُرسلت هذه الرسالة من ${ltrText(company.name)} عبر ${ltrText("SpartaFlow")}.`,
  };
}

/** The header badge: the org's logo, or its initial on a coloured tile. */
function logoHtml(company: EmailCompany): string {
  return company.logoUrl
    ? `<img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" width="36" height="36" style="display:block;border-radius:8px;border:0;" />`
    : `<div style="width:36px;height:36px;border-radius:8px;background:${C.primary};color:${C.primaryFg};font-family:${FONT};font-size:17px;font-weight:700;line-height:36px;text-align:center;">${escapeHtml(company.name.charAt(0).toUpperCase())}</div>`;
}

export interface EmailShellInput {
  company: EmailCompany;
  /**
   * Inbox preview line. Shown by the client next to the subject and hidden in
   * the body — pass plain text; it is escaped here.
   */
  preheader: string;
  /** The card's inner HTML. Already escaped/sanitized by the caller. */
  cardHtml: string;
}

/** Wrap a card body in the standard branded shell. */
export function renderEmailShell({ company, preheader, cardHtml }: EmailShellInput): string {
  const sentBy = senderNotice(company);

  return `<div style="background:${C.bg};margin:0;padding:32px 12px;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="padding:0 0 20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:10px;">${logoHtml(company)}</td>
            <td style="font-family:${FONT};font-size:15px;font-weight:600;color:${C.fg};">${escapeHtml(company.name)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:${C.card};border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
${cardHtml}
      </td>
    </tr>
    <tr>
      <td dir="rtl" style="padding:18px 4px 0 4px;font-family:${FONT};font-size:11px;color:${C.muted};line-height:1.7;text-align:right;">
        ${sentBy.ar}<br /><span dir="ltr">${escapeHtml(sentBy.en)}</span>
      </td>
    </tr>
  </table>
</div>`;
}

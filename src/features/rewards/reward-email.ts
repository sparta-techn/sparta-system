/**
 * Reward email template — the bilingual "you've received a reward" message.
 *
 * PURE and isomorphic, mirroring `payroll/payslip-email.ts`: takes the reward
 * figures and returns a rendered email (subject + HTML + text). Arabic (RTL) is
 * the primary language, English the secondary — each block carries its own
 * `dir`/`lang` so clients never guess direction.
 *
 * Bidi rule: any Latin-script run inside RTL text (the company name, the
 * formatted amount, a Latin employee name) is explicitly LTR-isolated —
 * `<span dir="ltr">` in HTML, U+2066/U+2069 (LRI…PDI) in plain text — so
 * "Sparta Flow" and "1,000.00 EGP" don't get their word/digit order mangled
 * by the surrounding Arabic. Strings that already contain Arabic are left
 * alone. Layout is table-based with inline styles, same as the payslip.
 */

import {
  ltrHtml,
  ltrText,
  renderEmailShell,
  senderNotice,
  type EmailCompany,
} from "@/features/payroll/email-shell";
import {
  EMAIL_COLORS as C,
  EMAIL_FONT as FONT,
  escapeHtml,
} from "@/features/payroll/payslip-email";
import { formatMoney } from "@/features/payroll/summary";

export type RewardCompany = EmailCompany;

export interface RewardEmailInput {
  /** Recipient's display name (may be Arabic or Latin script). */
  employeeName: string;
  amount: number;
  currency: string;
  /** Optional free-text reason, in whichever language HR wrote it. */
  reason?: string | null;
  company: RewardCompany;
  /** Human date label for when the reward was sent, e.g. "8 August 2026". */
  sentAtLabel?: string;
}

export interface RenderedRewardEmail {
  subject: string;
  html: string;
  text: string;
}

/** Render the reward email (Arabic-primary subject + HTML + text fallback). */
export function renderRewardEmail(input: RewardEmailInput): RenderedRewardEmail {
  const { employeeName, amount, currency, company, sentAtLabel } = input;
  const reason = input.reason?.trim() || null;
  const money = formatMoney(amount, currency);
  const firstName = employeeName.split(" ")[0] || employeeName;

  const subject = `🎉 مكافأة جديدة لك | You've received a reward`;

  // Header, card chrome and the "sent by" footer come from the shared shell —
  // the reward email decides only what goes INSIDE the card.
  const sentBy = senderNotice(company);
  const sentByAr = sentBy.ar;
  const sentByEn = sentBy.en;

  // ── HTML ────────────────────────────────────────────────────────────────────
  const cardHtml = `
        <!-- Hero: the reward amount -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="rtl" style="padding:28px 28px 24px 28px;background:${C.successSoft};border-bottom:1px solid ${C.border};text-align:right;">
              <div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:.06em;color:${C.success};">
                🎉 مكافأة &middot; <span dir="ltr">Reward</span>
              </div>
              <div dir="ltr" style="font-family:${FONT};font-size:34px;font-weight:700;color:${C.fg};margin-top:10px;line-height:1.15;text-align:right;">
                ${escapeHtml(money)}
              </div>
              ${
                sentAtLabel
                  ? `<div style="font-family:${FONT};font-size:13px;color:${C.muted};margin-top:6px;">${ltrHtml(sentAtLabel)}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>

        <!-- Arabic (primary) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="rtl" lang="ar" style="padding:26px 28px 6px 28px;font-family:${FONT};font-size:15px;color:${C.fg};line-height:1.9;text-align:right;">
              مرحباً ${ltrHtml(firstName)}،<br />
              يسعدنا إبلاغك بحصولك على مكافأة قدرها <strong dir="ltr">${escapeHtml(money)}</strong> من ${ltrHtml(company.name)} تقديراً لجهودك المتميزة. شكراً لك على عملك الرائع! 🎉
            </td>
          </tr>
        </table>

        <!-- English (secondary) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="ltr" lang="en" style="padding:18px 28px 6px 28px;font-family:${FONT};font-size:14px;color:${C.muted};line-height:1.7;border-top:1px solid ${C.border};margin-top:12px;">
              Hi ${escapeHtml(firstName)}, we're delighted to let you know you've received a reward of <strong style="color:${C.fg};">${escapeHtml(money)}</strong> from ${escapeHtml(company.name)} in recognition of your outstanding work. Thank you! 🎉
            </td>
          </tr>
        </table>

        ${
          reason
            ? `<!-- Reason: free text in whichever language HR wrote it (dir=auto) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:20px 28px 4px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;">
              <tr><td style="padding:14px 16px;">
                <div dir="rtl" style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.07em;color:${C.muted};text-align:right;">
                  سبب المكافأة &middot; <span dir="ltr">REASON</span>
                </div>
                <div dir="auto" style="font-family:${FONT};font-size:14px;color:${C.fg};line-height:1.7;margin-top:6px;">
                  ${escapeHtml(reason)}
                </div>
              </td></tr>
            </table>
          </td></tr>
        </table>`
            : ""
        }

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="rtl" style="padding:22px 28px 28px 28px;font-family:${FONT};font-size:13px;color:${C.muted};line-height:1.8;text-align:right;">
              ${
                company.supportEmail
                  ? `لأي استفسار، تواصل معنا على <a dir="ltr" href="mailto:${escapeHtml(company.supportEmail)}" style="color:${C.primary};text-decoration:none;">${escapeHtml(company.supportEmail)}</a>. — For any questions, contact us at the address above.`
                  : `لأي استفسار، يمكنك الرد على هذه الرسالة مباشرة. — For any questions, just reply to this email.`
              }
            </td>
          </tr>
        </table>
`;

  const html = renderEmailShell({
    company,
    preheader: `مكافأة قدرها ${money} تقديراً لجهودك — You've received a reward of ${money}.`,
    cardHtml,
  });

  // ── Plain text fallback ─────────────────────────────────────────────────────
  const textLines: string[] = [
    `🎉 مكافأة جديدة لك`,
    "",
    `مرحباً ${ltrText(firstName)}،`,
    `يسعدنا إبلاغك بحصولك على مكافأة قدرها ${ltrText(money)} من ${ltrText(company.name)} تقديراً لجهودك المتميزة. شكراً لك على عملك الرائع!`,
  ];
  if (reason) textLines.push("", `سبب المكافأة: ${reason}`);
  textLines.push(
    "",
    "— — —",
    "",
    `Hi ${firstName},`,
    `You've received a reward of ${money} from ${company.name} in recognition of your outstanding work. Thank you!`,
  );
  if (reason) textLines.push("", `Reason: ${reason}`);
  if (sentAtLabel) textLines.push("", ltrText(sentAtLabel));
  textLines.push(
    "",
    company.supportEmail
      ? `لأي استفسار: ${ltrText(company.supportEmail)} — For any questions, contact ${company.supportEmail}.`
      : `لأي استفسار، يمكنك الرد على هذه الرسالة. — For any questions, just reply to this email.`,
    "",
    `${sentByAr}`,
    `${sentByEn}`,
  );

  return { subject, html, text: textLines.join("\n") };
}

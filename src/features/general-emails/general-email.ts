/**
 * General (broadcast) email template — HR's free-text message to the team.
 *
 * PURE and isomorphic, like the payslip and reward templates. It supplies only
 * the card's contents; the header, card chrome and "sent by" footer come from
 * the shared `renderEmailShell`, so a broadcast is visibly the same product as
 * a payslip without the branding being written twice.
 *
 * Bidi handling differs from the reward email in an important way. There, the
 * Latin runs needing isolation were KNOWN values (a company name, an amount).
 * Here the body is free text an author typed, so the Latin runs are discovered:
 * when the body contains Arabic, {@link isolateLatinRuns} wraps each Latin-script
 * run in `<span dir="ltr">` so brand names, URLs and numbers keep their word and
 * digit order inside RTL paragraphs. A body with no Arabic is left alone — every
 * run would be isolated, which is just noise.
 */
import { ltrHtml, renderEmailShell, type EmailCompany } from "@/features/payroll/email-shell";
import {
  EMAIL_COLORS as C,
  EMAIL_FONT as FONT,
  escapeHtml,
} from "@/features/payroll/payslip-email";

export type GeneralEmailCompany = EmailCompany;

export interface GeneralEmailInput {
  /** Subject line, as typed. */
  subject: string;
  /** Body HTML — MUST already be through `sanitizeEmailHtml`. */
  bodyHtml: string;
  /** Recipient's display name, for the greeting. */
  employeeName: string;
  company: GeneralEmailCompany;
}

export interface RenderedGeneralEmail {
  subject: string;
  html: string;
  text: string;
}

const HAS_ARABIC = /[؀-ۿ]/;

/**
 * A run of Latin script worth isolating: starts with a Latin letter and may run
 * on through digits, punctuation and internal spaces (so "Sparta Flow" and
 * "https://x.com/a_b" each stay whole rather than fragmenting).
 */
const LATIN_RUN =
  /[A-Za-z][A-Za-z0-9._@'+\-/&:()]*(?:[ \t]+[A-Za-z0-9._@'+\-/&:()]*[A-Za-z0-9)])*/g;

/** Tags, character references, and everything between them. */
const MARKUP_OR_ENTITY = /<[^>]*>|&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});/g;

/**
 * Wrap Latin-script runs in `<span dir="ltr">`, touching only text.
 *
 * Tags are stepped over so attributes are never rewritten, and character
 * references are treated as atomic — splitting `&amp;` into
 * `&<span dir="ltr">amp</span>;` would corrupt it into visible text.
 */
export function isolateLatinRuns(html: string): string {
  const wrap = (text: string) => text.replace(LATIN_RUN, (run) => `<span dir="ltr">${run}</span>`);

  const out: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MARKUP_OR_ENTITY.lastIndex = 0;
  while ((match = MARKUP_OR_ENTITY.exec(html)) !== null) {
    out.push(wrap(html.slice(lastIndex, match.index)));
    out.push(match[0]); // A tag or an entity — passed through untouched.
    lastIndex = MARKUP_OR_ENTITY.lastIndex;
  }
  out.push(wrap(html.slice(lastIndex)));

  return out.join("");
}

/** Strip tags to a readable plain-text fallback. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|li|ul|ol|blockquote)\s*>/gi, "\n")
    .replace(/<\s*li\s*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Render one recipient's copy of a broadcast. */
export function renderGeneralEmail(input: GeneralEmailInput): RenderedGeneralEmail {
  const { subject, bodyHtml, employeeName, company } = input;
  const firstName = employeeName.split(" ")[0] || employeeName;

  // Only isolate when the body actually mixes scripts — see the module note.
  const body = HAS_ARABIC.test(bodyHtml) ? isolateLatinRuns(bodyHtml) : bodyHtml;

  const cardHtml = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="auto" style="padding:26px 28px 8px 28px;font-family:${FONT};font-size:19px;font-weight:700;color:${C.fg};line-height:1.4;border-bottom:1px solid ${C.border};padding-bottom:18px;">
              ${escapeHtml(subject)}
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="auto" style="padding:20px 28px 6px 28px;font-family:${FONT};font-size:15px;color:${C.fg};line-height:1.8;">
              ${ltrHtml(firstName)}،<br />
            </td>
          </tr>
        </table>

        <!-- Author's body. dir="auto" lets each block pick its own direction. -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="auto" style="padding:4px 28px 22px 28px;font-family:${FONT};font-size:15px;color:${C.fg};line-height:1.8;">
              ${body}
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td dir="rtl" style="padding:0 28px 26px 28px;font-family:${FONT};font-size:13px;color:${C.muted};line-height:1.8;text-align:right;border-top:1px solid ${C.border};padding-top:18px;">
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
    preheader: htmlToText(bodyHtml).slice(0, 140),
    cardHtml,
  });

  const text = [
    subject,
    "",
    `${firstName}،`,
    "",
    htmlToText(bodyHtml),
    "",
    "— — —",
    "",
    company.supportEmail
      ? `لأي استفسار: ${company.supportEmail} — For any questions, contact ${company.supportEmail}.`
      : `لأي استفسار، يمكنك الرد على هذه الرسالة. — For any questions, just reply to this email.`,
  ].join("\n");

  return { subject, html, text };
}

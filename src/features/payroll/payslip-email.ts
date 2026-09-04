/**
 * Payslip email template — the "you've been paid" message.
 *
 * PURE and isomorphic: takes a {@link PayrollLine} straight from the
 * server-side `payroll_report` function and returns a rendered email. It does
 * no arithmetic of its own, so the email and the .xlsx export are physically
 * incapable of disagreeing — they read the same row. Overtime is removed from
 * the pipeline: every overtime line here sits behind the `overtime` scope gate,
 * retained so a historical payslip can still be re-rendered faithfully.
 *
 * Styling mirrors the app's design tokens (`src/styles.css`), converted from
 * oklch to hex because email clients don't support oklch. Layout is table-based
 * with inline styles — the only thing Outlook, Gmail and Apple Mail all render
 * the same way.
 */

import { isFeatureInMvp } from "@/config/mvp-scope";

import type { PayrollLine } from "./types";
import { formatMoney } from "./summary";

/** Overtime is removed from the product; the payslip no longer mentions it. */
const SHOW_OVERTIME = isFeatureInMvp("overtime");

/** App design tokens (src/styles.css), converted oklch → hex for email clients. */
const C = {
  bg: "#f5f7f9",
  card: "#ffffff",
  fg: "#0d121b",
  muted: "#5d646e",
  border: "#e1e5ea",
  primary: "#3f61ea",
  primarySoft: "#eaf2ff",
  primaryFg: "#ffffff",
  success: "#0ea053",
  successSoft: "#d7f9de",
  warning: "#ea9602",
  warningSoft: "#ffeec5",
  warningFg: "#261704",
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";

/** Shared with other transactional emails (e.g. rewards) so they match the app shell. */
export { C as EMAIL_COLORS, FONT as EMAIL_FONT };

export interface PayslipCompany {
  name: string;
  logoUrl?: string | null;
  /** Shown in the footer as the "something looks wrong" contact. */
  supportEmail?: string | null;
}

export interface PayslipEmailInput {
  /** The employee's row, exactly as returned by `payroll_report`. */
  line: PayrollLine;
  /** Human label for the period, e.g. "July 2026". */
  periodLabel: string;
  company: PayslipCompany;
  /** When the transfer was confirmed. Defaults to "today" being omitted. */
  paidAtLabel?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const n = (v: number | null | undefined): number => Number(v ?? 0);
const hrs = (v: number | null | undefined): string => `${n(v)}h`;

/** One label/value line in the "This month" detail block. */
interface DetailRow {
  label: string;
  value: string;
  /** Renders in warning colour — used for anything UNPAID, never hidden. */
  emphasis?: "warning";
  note?: string;
}

/**
 * The factual detail rows for the period. Unpaid items are always included when
 * non-zero: an employee should learn about a deduction from their payslip, not
 * by noticing the total is short.
 */
export function payslipDetailRows(line: PayrollLine): DetailRow[] {
  const rows: DetailRow[] = [];
  const isPartTime = line.employment_type === "part-time";

  if (!isPartTime) {
    rows.push({
      label: "Working days",
      value: `${n(line.present_days)} of ${n(line.expected_days)} worked`,
    });
  }
  rows.push({ label: "Hours worked", value: hrs(line.worked_hours) });

  if (n(line.paid_exception_count) > 0) {
    rows.push({
      label: "Paid exceptions",
      value: `${n(line.paid_exception_count)} (${hrs(line.paid_exception_hours)})`,
      note: "Approved time off that counts as paid time",
    });
  }
  if (n(line.unpaid_exception_count) > 0) {
    rows.push({
      label: "Unpaid exceptions",
      value: `${n(line.unpaid_exception_count)} (${hrs(line.unpaid_exception_hours)})`,
      emphasis: "warning",
      note: "Logged time off that is not paid",
    });
  }
  if (n(line.absence_days) > 0) {
    rows.push({
      label: "Unpaid absence days",
      value: `${n(line.absence_days)}`,
      emphasis: "warning",
      note: "Expected working days with no attendance and no exception logged",
    });
  }
  if (SHOW_OVERTIME && n(line.overtime_pending_count) > 0) {
    rows.push({
      label: "Overtime awaiting approval",
      value: `${n(line.overtime_pending_count)} request(s)`,
      note: "Not included in this payment — it will be paid once approved",
    });
  }
  return rows;
}

/** `<tr>` for one figure in the pay breakdown. */
function amountRow(
  label: string,
  sublabel: string | null,
  amount: string,
  opts: { strong?: boolean } = {},
): string {
  const weight = opts.strong ? "600" : "400";
  return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:15px;color:${C.fg};font-weight:${weight};">
              ${escapeHtml(label)}${
                sublabel
                  ? `<div style="font-size:12px;color:${C.muted};font-weight:400;margin-top:3px;">${escapeHtml(sublabel)}</div>`
                  : ""
              }
            </td>
            <td align="right" style="padding:12px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:15px;color:${C.fg};font-weight:${weight};white-space:nowrap;">
              ${escapeHtml(amount)}
            </td>
          </tr>`;
}

function detailRowHtml(row: DetailRow): string {
  const color = row.emphasis === "warning" ? C.warningFg : C.fg;
  return `
          <tr>
            <td style="padding:9px 0;font-family:${FONT};font-size:13px;color:${C.muted};vertical-align:top;">
              ${escapeHtml(row.label)}${
                row.note
                  ? `<div style="font-size:11px;color:${C.muted};margin-top:2px;">${escapeHtml(row.note)}</div>`
                  : ""
              }
            </td>
            <td align="right" style="padding:9px 0;font-family:${FONT};font-size:13px;color:${color};font-weight:600;white-space:nowrap;vertical-align:top;">
              ${escapeHtml(row.value)}
            </td>
          </tr>`;
}

/** Render the payslip email (subject + HTML + plain-text fallback). */
export function renderPayslipEmail(input: PayslipEmailInput): RenderedEmail {
  const { line, periodLabel, company, paidAtLabel } = input;
  const name = line.employee_name ?? "there";
  const firstName = name.split(" ")[0] || name;
  const money = (v: number | null | undefined) => formatMoney(v, line.currency);

  const hasOvertime = SHOW_OVERTIME && (n(line.overtime_hours) > 0 || n(line.overtime_pay) > 0);
  const isPartTime = line.employment_type === "part-time";
  const details = payslipDetailRows(line);

  const subject = `Your ${periodLabel} salary has been paid`;

  // The org running SpartaFlow may itself be called SpartaFlow — don't say
  // "Sent by SpartaFlow via SpartaFlow".
  const sentBy =
    company.name.trim().toLowerCase() === "spartaflow"
      ? `Sent by ${company.name}.`
      : `Sent by ${company.name} via SpartaFlow.`;

  const baseSublabel = isPartTime
    ? `${hrs(line.worked_hours)} worked${
        n(line.paid_exception_hours) > 0
          ? ` + ${hrs(line.paid_exception_hours)} paid exception`
          : ""
      }`
    : `${n(line.present_days)} of ${n(line.expected_days)} working days`;

  // ── HTML ────────────────────────────────────────────────────────────────────
  const logo = company.logoUrl
    ? `<img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" width="36" height="36" style="display:block;border-radius:8px;border:0;" />`
    : `<div style="width:36px;height:36px;border-radius:8px;background:${C.primary};color:${C.primaryFg};font-family:${FONT};font-size:17px;font-weight:700;line-height:36px;text-align:center;">${escapeHtml(company.name.charAt(0).toUpperCase())}</div>`;

  const html = `<div style="background:${C.bg};margin:0;padding:32px 12px;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${escapeHtml(periodLabel)} salary of ${escapeHtml(money(line.total_pay))} has been transferred.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="padding:0 0 20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:10px;">${logo}</td>
            <td style="font-family:${FONT};font-size:15px;font-weight:600;color:${C.fg};">${escapeHtml(company.name)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:${C.card};border:1px solid ${C.border};border-radius:14px;overflow:hidden;">

        <!-- Hero: the number that matters -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:28px 28px 24px 28px;background:${C.primarySoft};border-bottom:1px solid ${C.border};">
              <div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${C.primary};">
                Salary paid &middot; ${escapeHtml(periodLabel)}
              </div>
              <div style="font-family:${FONT};font-size:34px;font-weight:700;color:${C.fg};margin-top:10px;line-height:1.15;">
                ${escapeHtml(money(line.total_pay))}
              </div>
              ${
                paidAtLabel
                  ? `<div style="font-family:${FONT};font-size:13px;color:${C.muted};margin-top:6px;">Transferred on ${escapeHtml(paidAtLabel)}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:26px 28px 6px 28px;font-family:${FONT};font-size:15px;color:${C.fg};line-height:1.6;">
              Hi ${escapeHtml(firstName)}, your salary for <strong>${escapeHtml(periodLabel)}</strong> has been transferred to your bank account. Here's the breakdown.
            </td>
          </tr>
        </table>

        <!-- Pay breakdown -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:0 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td colspan="2" style="padding:18px 0 4px 0;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${C.muted};">
                  Breakdown
                </td>
              </tr>
${amountRow("Base pay", baseSublabel, money(line.base_pay))}
${
  hasOvertime
    ? amountRow("Overtime", `${hrs(line.overtime_hours)} approved`, money(line.overtime_pay))
    : ""
}
              <tr>
                <td style="padding:16px 0 0 0;font-family:${FONT};font-size:16px;font-weight:700;color:${C.fg};">Total paid</td>
                <td align="right" style="padding:16px 0 0 0;font-family:${FONT};font-size:20px;font-weight:700;color:${C.success};white-space:nowrap;">
                  ${escapeHtml(money(line.total_pay))}
                </td>
              </tr>
            </table>
          </td></tr>
        </table>

        ${
          details.length > 0
            ? `<!-- This month: attendance, exceptions and anything unpaid -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:24px 28px 4px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;">
              <tr><td style="padding:6px 16px 12px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td colspan="2" style="padding:12px 0 6px 0;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${C.muted};">
                      This month
                    </td>
                  </tr>
${details.map(detailRowHtml).join("")}
                </table>
              </td></tr>
            </table>
          </td></tr>
        </table>`
            : ""
        }

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:22px 28px 28px 28px;font-family:${FONT};font-size:13px;color:${C.muted};line-height:1.6;">
              ${
                hasOvertime
                  ? `Overtime shown here is <strong style="color:${C.fg};">approved overtime only</strong>, paid separately from your base salary. `
                  : ""
              }${
                company.supportEmail
                  ? `If any of these figures look wrong, reply to this email or contact <a href="mailto:${escapeHtml(company.supportEmail)}" style="color:${C.primary};text-decoration:none;">${escapeHtml(company.supportEmail)}</a>.`
                  : `If any of these figures look wrong, just reply to this email.`
              }
            </td>
          </tr>
        </table>

      </td>
    </tr>
    <tr>
      <td style="padding:18px 4px 0 4px;font-family:${FONT};font-size:11px;color:${C.muted};line-height:1.5;">
        ${escapeHtml(sentBy)} This is a record of a completed bank transfer, not a request for any action.
      </td>
    </tr>
  </table>
</div>`;

  // ── Plain text fallback ─────────────────────────────────────────────────────
  const textLines: string[] = [
    `Your ${periodLabel} salary has been paid`,
    "",
    `Hi ${firstName},`,
    "",
    `Your salary for ${periodLabel} has been transferred to your bank account.`,
  ];
  if (paidAtLabel) textLines.push(`Transferred on ${paidAtLabel}.`);
  textLines.push("", "BREAKDOWN", `  Base pay (${baseSublabel}): ${money(line.base_pay)}`);
  if (hasOvertime) {
    textLines.push(
      `  Overtime (${hrs(line.overtime_hours)} approved): ${money(line.overtime_pay)}`,
    );
  }
  textLines.push(`  TOTAL PAID: ${money(line.total_pay)}`);

  if (details.length > 0) {
    textLines.push("", "THIS MONTH");
    for (const d of details) {
      textLines.push(`  ${d.label}: ${d.value}${d.note ? ` — ${d.note}` : ""}`);
    }
  }
  textLines.push("");
  if (hasOvertime) {
    textLines.push(
      "Overtime shown here is approved overtime only, paid separately from your base salary.",
    );
  }
  textLines.push(
    company.supportEmail
      ? `If any of these figures look wrong, reply to this email or contact ${company.supportEmail}.`
      : "If any of these figures look wrong, just reply to this email.",
    "",
    sentBy,
  );

  return { subject, html, text: textLines.join("\n") };
}

/**
 * Payslip corrections — SERVER ONLY.
 *
 * Fixing a figure on an already-sent payslip, without ever editing the record of
 * what was sent. `payslip_deliveries` stays immutable: a correction is logged
 * here as its own fact, and is APPLIED by re-sending, which appends a new
 * delivery row carrying the corrected numbers.
 *
 * The one rule this file exists to hold: the corrected figures HR sees on screen
 * and the corrected figures the employee is emailed are produced by the SAME
 * function ({@link applyCorrections}), over the SAME `payroll_report()` line, so
 * a preview can never disagree with what actually goes out.
 *
 * Overtime is corrected in HOURS, never in money. The pay is re-derived from the
 * hours by `overtime_pay_for_hours()` — the same rate and arithmetic the payroll
 * report uses — so the payslip's "N hours approved — X" line always reconciles.
 *
 * Runs with the service-role client. Import ONLY from a server handler via
 * `await import(...)`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ServiceError, toServiceError } from "@/services/core/errors";

import { overlayCorrections, round2, totalOf, type CorrectableField } from "./corrections";
import type { PayrollLine } from "./types";

export type { CorrectableField };

/** Relaxed handle for tables not present in the generated `Database` types. */
function admin(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

export interface PayslipCorrection {
  id: string;
  deliveryId: string;
  employeeId: string;
  field: CorrectableField;
  /** Unit follows `field`: money for base_pay, hours for overtime_hours. */
  oldValue: number;
  newValue: number;
  reason: string;
  editedBy: string | null;
  /** Display name of the editor, resolved from `profiles`. */
  editedByName: string | null;
  editedAt: string;
  /** Null while logged but not yet re-sent — the employee still has the old figure. */
  appliedDeliveryId: string | null;
}

/** Pay figures after any pending corrections are laid over the computed line. */
export interface EffectiveFigures {
  basePay: number;
  overtimeHours: number;
  overtimePay: number;
  totalPay: number;
  /** Which figures differ from the freshly-computed payroll line. */
  correctedFields: CorrectableField[];
}

const n = (v: unknown): number => Number(v ?? 0);

/**
 * Full correction history for a period, newest first, keyed by employee.
 * Includes already-applied corrections — the history is the point.
 */
export async function listCorrections(
  from: string,
  to: string,
): Promise<Map<string, PayslipCorrection[]>> {
  // Two steps rather than an embedded filter: `payslip_edit_log` has TWO foreign
  // keys into `payslip_deliveries` (delivery_id and applied_delivery_id), so an
  // embed would need a constraint-name hint and break the moment one is renamed.
  const { data: deliveryRows, error: deliveryError } = await admin()
    .from("payslip_deliveries")
    .select("id")
    .eq("period_from", from)
    .eq("period_to", to);
  if (deliveryError) {
    throw toServiceError(deliveryError, "Couldn't load payslip correction history.");
  }

  const deliveryIds = ((deliveryRows ?? []) as Array<{ id: string }>).map((d) => d.id);
  if (deliveryIds.length === 0) return new Map();

  const { data, error } = await admin()
    .from("payslip_edit_log")
    .select(
      "id, delivery_id, employee_id, field_changed, old_value, new_value, reason, edited_by, edited_at, applied_delivery_id",
    )
    .in("delivery_id", deliveryIds)
    .order("edited_at", { ascending: false });
  if (error) throw toServiceError(error, "Couldn't load payslip correction history.");

  const rows = (data ?? []) as Array<{
    id: string;
    delivery_id: string;
    employee_id: string;
    field_changed: CorrectableField;
    old_value: number;
    new_value: number;
    reason: string;
    edited_by: string | null;
    edited_at: string;
    applied_delivery_id: string | null;
  }>;

  const names = await editorNames(rows.map((r) => r.edited_by));

  const byEmployee = new Map<string, PayslipCorrection[]>();
  for (const r of rows) {
    const list = byEmployee.get(r.employee_id) ?? [];
    list.push({
      id: r.id,
      deliveryId: r.delivery_id,
      employeeId: r.employee_id,
      field: r.field_changed,
      oldValue: n(r.old_value),
      newValue: n(r.new_value),
      reason: r.reason,
      editedBy: r.edited_by,
      editedByName: r.edited_by ? (names.get(r.edited_by) ?? null) : null,
      editedAt: r.edited_at,
      appliedDeliveryId: r.applied_delivery_id,
    });
    byEmployee.set(r.employee_id, list);
  }
  return byEmployee;
}

/** Display names for a set of editor user ids. */
async function editorNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const { data, error } = await admin()
    .from("profiles")
    .select("id, display_name, full_name")
    .in("id", unique);
  if (error) return new Map(); // A missing name must never break the history view.

  return new Map(
    ((data ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null }>)
      .map((p) => [p.id, p.display_name ?? p.full_name ?? ""] as const)
      .filter(([, name]) => name.length > 0),
  );
}

/** Corrections for one employee+period that have been logged but not yet re-sent. */
export async function pendingCorrections(
  employeeId: string,
  from: string,
  to: string,
): Promise<PayslipCorrection[]> {
  const all = (await listCorrections(from, to)).get(employeeId) ?? [];
  // Oldest first: later corrections to the same field must win.
  return all.filter((c) => c.appliedDeliveryId === null).reverse();
}

/**
 * Lay pending corrections over a freshly-computed payroll line.
 *
 * `base_pay` is taken as an absolute override. `overtime_hours` is taken as an
 * override too, but the PAY is re-derived from it in the database so the hours
 * and the money on the payslip can never disagree.
 */
export async function applyCorrections(
  line: PayrollLine,
  corrections: PayslipCorrection[],
  from: string,
): Promise<EffectiveFigures> {
  const { basePay, overtimeHours, correctedFields } = overlayCorrections(
    { basePay: n(line.base_pay), overtimeHours: n(line.overtime_hours) },
    corrections,
  );
  let overtimePay = n(line.overtime_pay);

  if (correctedFields.includes("overtime_hours")) {
    // Priced in the DATABASE, never here: `overtime_pay_for_hours` applies the
    // same rate and rounding as the payroll report, so a corrected hours figure
    // and its pay cannot drift from the way overtime is normally calculated.
    // Called through the relaxed handle because the generated `Database` types
    // are regenerated after the migration is applied, not before.
    const { data, error } = await admin().rpc("overtime_pay_for_hours", {
      _employee_id: line.employee_id,
      _ref: from,
      _hours: overtimeHours,
    });
    if (error) throw toServiceError(error, "Couldn't price the corrected overtime hours.");
    if (data === null || data === undefined) {
      throw new ServiceError(
        `${line.employee_name ?? "This employee"} has no pay rate configured, so corrected overtime hours can't be priced. Set their pay rate first.`,
        "invalid_request",
      );
    }
    overtimePay = n(data);
  }

  return {
    basePay,
    overtimeHours,
    overtimePay: round2(overtimePay),
    totalPay: totalOf(basePay, overtimePay),
    correctedFields,
  };
}

/** The freshly-computed line with corrected figures written over it. */
export function correctedLine(line: PayrollLine, figures: EffectiveFigures): PayrollLine {
  return {
    ...line,
    base_pay: figures.basePay,
    overtime_hours: figures.overtimeHours,
    overtime_pay: figures.overtimePay,
    total_pay: figures.totalPay,
  };
}

export interface LogCorrectionInput {
  employeeId: string;
  from: string;
  to: string;
  field: CorrectableField;
  newValue: number;
  reason: string;
  editedByUserId: string;
}

/**
 * Record a correction against the latest payslip sent for this employee+period.
 *
 * `old_value` is derived here, never accepted from the client: it is the figure
 * currently in effect (the computed line plus any pending corrections), so the
 * log reads as a truthful chain even after several successive corrections.
 */
export async function logCorrection(input: LogCorrectionInput): Promise<PayslipCorrection> {
  const { employeeId, from, to, field, newValue, reason, editedByUserId } = input;

  // A payslip must have been SENT before it can be corrected.
  const { data: deliveryRow, error: deliveryError } = await admin()
    .from("payslip_deliveries")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("period_from", from)
    .eq("period_to", to)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deliveryError) throw toServiceError(deliveryError, "Couldn't find the payslip to correct.");

  const deliveryId = (deliveryRow as { id: string } | null)?.id;
  if (!deliveryId) {
    throw new ServiceError(
      "No payslip has been sent for this employee and period, so there is nothing to correct.",
      "not_found",
    );
  }

  const { line, figures } = await effectiveFor(employeeId, from, to);
  const oldValue = field === "base_pay" ? figures.basePay : figures.overtimeHours;

  if (round2(oldValue) === round2(newValue)) {
    throw new ServiceError(
      `That is already the current ${field === "base_pay" ? "base pay" : "overtime hours"} figure — nothing to correct.`,
      "invalid_request",
    );
  }

  const { data, error } = await admin()
    .from("payslip_edit_log")
    .insert({
      delivery_id: deliveryId,
      employee_id: employeeId,
      field_changed: field,
      old_value: round2(oldValue),
      new_value: round2(newValue),
      reason: reason.trim(),
      edited_by: editedByUserId,
    })
    .select("id, edited_at")
    .single();
  if (error) throw toServiceError(error, "Couldn't record the payslip correction.");

  const { auditLog } = await import("@/lib/logging");
  auditLog.record(
    {
      action: "payroll.payslip_corrected",
      targetTable: "payslip_edit_log",
      targetId: (data as { id: string }).id,
      after: {
        employeeId,
        employeeName: line.employee_name,
        period: { from, to },
        field,
        oldValue: round2(oldValue),
        newValue: round2(newValue),
        reason: reason.trim(),
      },
      reason: `Corrected ${line.employee_name}'s ${field === "base_pay" ? "base pay" : "overtime hours"} for ${from} — ${to}. Not yet re-sent.`,
    },
    { userId: editedByUserId },
  );

  return {
    id: (data as { id: string }).id,
    deliveryId,
    employeeId,
    field,
    oldValue: round2(oldValue),
    newValue: round2(newValue),
    reason: reason.trim(),
    editedBy: editedByUserId,
    editedByName: null,
    editedAt: (data as { edited_at: string }).edited_at,
    appliedDeliveryId: null,
  };
}

/** Correction history plus currently-effective figures, for one employee. */
export interface CorrectionState {
  employeeId: string;
  /** Full history, newest first — applied and pending alike. */
  corrections: PayslipCorrection[];
  /** Corrections logged but not yet carried to the employee by a resend. */
  pendingCount: number;
  /**
   * Figures after pending corrections. Null when nothing is pending, in which
   * case the payroll table's own line is already what the employee holds.
   */
  effective: EffectiveFigures | null;
}

/**
 * Correction state for every employee in the period.
 *
 * The effective figures are computed HERE, on the server, by the same
 * {@link applyCorrections} the send path uses — so the corrected total shown in
 * the payroll table is by construction the total that will be emailed, rather
 * than a second front-end approximation of it.
 */
export async function correctionStates(from: string, to: string): Promise<CorrectionState[]> {
  const byEmployee = await listCorrections(from, to);
  if (byEmployee.size === 0) return [];

  const { data, error } = await supabaseAdmin.rpc("payroll_report", { _from: from, _to: to });
  if (error) throw toServiceError(error, "Couldn't calculate payroll for this period.");
  const lines = new Map(
    ((data ?? []) as unknown as PayrollLine[]).map((l) => [l.employee_id, l] as const),
  );

  const states: CorrectionState[] = [];
  for (const [employeeId, corrections] of byEmployee) {
    // Oldest first: a later correction to the same field must win.
    const pending = corrections.filter((c) => c.appliedDeliveryId === null).reverse();
    const line = lines.get(employeeId);

    let effective: EffectiveFigures | null = null;
    if (pending.length > 0 && line) {
      try {
        effective = await applyCorrections(line, pending, from);
      } catch {
        // A single un-priceable employee (e.g. a pay rate removed after the
        // correction) must not blank the whole table — the history still shows.
        effective = null;
      }
    }

    states.push({ employeeId, corrections, pendingCount: pending.length, effective });
  }
  return states;
}

/** One employee's computed line plus its currently-effective figures. */
export async function effectiveFor(
  employeeId: string,
  from: string,
  to: string,
): Promise<{ line: PayrollLine; figures: EffectiveFigures; pending: PayslipCorrection[] }> {
  const { data, error } = await supabaseAdmin.rpc("payroll_report", { _from: from, _to: to });
  if (error) throw toServiceError(error, "Couldn't calculate payroll for this period.");

  const line = ((data ?? []) as unknown as PayrollLine[]).find((l) => l.employee_id === employeeId);
  if (!line) {
    throw new ServiceError(
      "This employee has no payroll line for the selected period.",
      "not_found",
    );
  }

  const pending = await pendingCorrections(employeeId, from, to);
  return { line, figures: await applyCorrections(line, pending, from), pending };
}

/**
 * Mark corrections as delivered by the resend that carried them.
 *
 * The only write this table ever takes after insert, and it is service-role
 * only — `authenticated` has no UPDATE grant, so a correction's history can
 * never be rewritten from a browser.
 */
export async function markCorrectionsApplied(
  correctionIds: string[],
  deliveryId: string,
): Promise<void> {
  if (correctionIds.length === 0) return;

  const { error } = await admin()
    .from("payslip_edit_log")
    .update({ applied_delivery_id: deliveryId })
    .in("id", correctionIds);

  if (error) {
    // The corrected payslip HAS gone out. Surface it rather than let the next
    // send silently re-apply the same corrections on top of an already-corrected
    // delivery.
    throw new ServiceError(
      `The corrected payslip was sent, but marking the corrections as applied failed: ${error.message}. They may be applied again on the next send.`,
      "record_failed",
      error,
    );
  }
}

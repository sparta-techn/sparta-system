import { supabase } from "@/integrations/supabase/client";

import type { PayrollLine } from "./types";

/**
 * The authoritative month-end payroll figures for `[from, to]` (`YYYY-MM-DD`).
 * Every number comes from the server-side `payroll_report` function — the single
 * source of truth — so the export and any on-screen preview cannot disagree.
 * Gated to `payroll.view`; throws for callers without it.
 */
export async function getPayrollReport(from: string, to: string): Promise<PayrollLine[]> {
  const { data, error } = await supabase.rpc("payroll_report", { _from: from, _to: to });
  if (error) throw error;
  return (data ?? []) as unknown as PayrollLine[];
}

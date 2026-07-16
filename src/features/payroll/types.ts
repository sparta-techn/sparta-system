import type { Database } from "@/integrations/supabase/types";

/** One employee's fully-computed pay figures for the period (from payroll_report). */
export type PayrollLine = Database["public"]["CompositeTypes"]["payroll_line"];

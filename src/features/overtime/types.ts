import type { Database } from "@/integrations/supabase/types";

export type OvertimeSession = Database["public"]["Tables"]["overtime_sessions"]["Row"];
export type OvertimeStatus = Database["public"]["Enums"]["overtime_status"];
export type OvertimePayLine = Database["public"]["CompositeTypes"]["overtime_pay_line"];

/** An overtime session enriched with the employee's display identity, for the
 *  manager approval queue. */
export interface OvertimeQueueRow {
  session: OvertimeSession;
  employee: {
    id: string;
    employee_code: string | null;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    employment_type_slug: string | null;
  };
}

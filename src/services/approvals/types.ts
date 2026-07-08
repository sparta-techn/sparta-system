/**
 * Approval domain types for the migration-`20260701120000` tables
 * (`approval_requests`, `approval_actions`). Snake-case rows; the actions table
 * is append-only. Not yet in generated `Database` types → relaxed `db` client.
 */

export type ApprovalType =
  | "eod_report"
  | "dependency_request"
  | "project_membership"
  | "role_grant"
  | "leave_request"
  | "timesheet"
  | "generic";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

export type ApprovalActionKind =
  | "requested"
  | "approved"
  | "rejected"
  | "cancelled"
  | "commented"
  | "reassigned";

// ── approval_requests ────────────────────────────────────────────────────────

export interface ApprovalRequestRow {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  requester_id: string;
  assignee_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  due_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}
export type ApprovalRequestInsert = Pick<ApprovalRequestRow, "title"> &
  Partial<Omit<ApprovalRequestRow, "title" | "id" | "created_at" | "updated_at">>;
export type ApprovalRequestUpdate = Partial<
  Pick<
    ApprovalRequestRow,
    "status" | "assignee_id" | "decided_by" | "decided_at" | "decision_note" | "due_at"
  >
>;

// ── approval_actions (append-only) ───────────────────────────────────────────

export interface ApprovalActionRow {
  id: string;
  approval_request_id: string;
  actor_id: string | null;
  action: ApprovalActionKind;
  note: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
export type ApprovalActionInsert = Pick<ApprovalActionRow, "approval_request_id" | "action"> &
  Partial<Pick<ApprovalActionRow, "actor_id" | "note" | "meta">>;

/**
 * Activity-feed domain types for the migration-`20260701120000` `activity_feed`
 * table. Snake-case row shape; append-only. Not yet in generated `Database`
 * types, so the service uses the relaxed `db` client.
 */

export type ActivitySource =
  | "task"
  | "dependency"
  | "project"
  | "sprint"
  | "report"
  | "membership"
  | "comment";

export interface ActivityFeedRow {
  id: string;
  actor_id: string | null;
  source_type: ActivitySource;
  source_id: string;
  project_id: string | null;
  kind: string;
  summary: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ActivityFeedInsert = Pick<
  ActivityFeedRow,
  "source_type" | "source_id" | "kind" | "summary"
> &
  Partial<Pick<ActivityFeedRow, "actor_id" | "project_id" | "meta">>;

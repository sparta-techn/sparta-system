/**
 * Context-grounding contracts. The Context Builder (`src/ai/context/`) turns a
 * {@link ContextRequest} into an authorized {@link ContextBlock} that the Prompt
 * Builder injects as delimited, cited grounding data.
 *
 * Enforcement note: a real resolver MUST read through a caller-scoped client so
 * Postgres RLS filters every row. This layer only defines the shapes.
 */

/** A single cited grounding row surfaced to the model. */
export interface ContextEntity {
  /** Domain type (`task`, `project`, `report`, …). */
  type: string;
  /** Row id. */
  id: string;
  /** Human reference for deep-linking (e.g. `ETB-142`). */
  ref?: string;
  /** Short, model-facing summary of the row. */
  summary: string;
}

/** Structured grounding data for one request. */
export interface ContextBlock {
  /** Natural-language framing of the context. */
  summary: string;
  /** Cited rows the user is authorized to see. */
  entities: ContextEntity[];
  /** True when rows were dropped to fit a budget. */
  truncated: boolean;
}

/** A request to build context for a given user + surface. */
export interface ContextRequest {
  surface: string | null;
  /** Grounding hints from the UI (selected ids, filters). */
  hints: Record<string, unknown>;
  /** The asking user — resolvers scope reads to this identity. */
  userId: string;
}

/**
 * A surface-specific context resolver. Registered by `surface` key; the default
 * resolver returns an empty block.
 */
export interface ContextResolver {
  readonly surface: string;
  resolve(request: ContextRequest): Promise<ContextBlock>;
}

/** Stable key for each module the AI can gather context from. */
export type ContextSourceKey =
  | "profile"
  | "attendance"
  | "daily_reports"
  | "projects"
  | "tasks"
  | "sprints"
  | "time_tracking"
  | "comments"
  | "dependencies"
  | "notifications";

/**
 * The output of one context source: the rows it contributed plus a short note
 * when there is nothing structured (or the source was unavailable).
 */
export interface ContextFragment {
  source: ContextSourceKey;
  /** Human label used in the merged summary (e.g. "Attendance"). */
  label: string;
  entities: ContextEntity[];
  /** True when rows were dropped to fit the source's budget. */
  truncated: boolean;
  /** Natural-language note when `entities` is empty or partial. */
  note?: string;
}

/**
 * A reusable, single-module context builder. Each source reads **only** through
 * the service layer (`@/services/*`) — never UI components or feature stores —
 * and maps rows into neutral {@link ContextEntity} values.
 */
export interface ContextSource {
  readonly key: ContextSourceKey;
  readonly label: string;
  gather(request: ContextRequest): Promise<ContextFragment>;
}

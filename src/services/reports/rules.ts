/**
 * SpartaFlow daily-report & dependency business rules (pure, side-effect-free).
 *
 * Rules encoded here:
 *  - Exactly one Morning Check-in / Midday Status / End-of-Day Report per
 *    employee per work date: a repeat submission edits the existing record
 *    rather than creating a duplicate (also enforced by the DB UNIQUE keys).
 *  - A dependency request stays Open until it is resolved (or otherwise reaches
 *    a terminal state); reaching resolved/closed stamps `resolved_at`.
 */
import type { DependencyState } from "@/features/dependencies/types";

// ── One-submission-per-day ───────────────────────────────────────────────────

export type SubmissionMode = "create" | "update";

/** A record that may or may not already exist for the day. */
type Maybe<T> = T | null | undefined;

/**
 * Resolve how a submit should be applied: `update` when a record already exists
 * for the `(user, date[, kind])` key, otherwise `create`. This is what keeps the
 * "only one per day" rule true while still allowing in-window edits.
 */
export function resolveSubmissionMode(existing: Maybe<{ id: string }>): SubmissionMode {
  return existing ? "update" : "create";
}

/** Whether a brand-new submission is allowed (i.e. none exists yet). */
export function canCreateSubmission(existing: Maybe<{ id: string }>): boolean {
  return resolveSubmissionMode(existing) === "create";
}

// ── Dependency open / terminal states ────────────────────────────────────────

/** States in which a dependency is no longer Open. */
export const TERMINAL_DEPENDENCY_STATES: readonly DependencyState[] = [
  "resolved",
  "closed",
  "cancelled",
  "rejected",
];

/** States that stamp `resolved_at` (the request was actually fulfilled/closed out). */
export const RESOLVED_DEPENDENCY_STATES: readonly DependencyState[] = ["resolved", "closed"];

/** A dependency stays Open until it reaches a terminal state. */
export function isDependencyOpen(state: DependencyState): boolean {
  return !TERMINAL_DEPENDENCY_STATES.includes(state);
}

/** The `resolved_at` value to persist for a state transition (`null` while open). */
export function resolvedAtFor(state: DependencyState, now: Date = new Date()): string | null {
  return RESOLVED_DEPENDENCY_STATES.includes(state) ? now.toISOString() : null;
}

/**
 * Shared helpers for context sources. Keep sources small and consistent: read a
 * hint, cap a list, format a duration, build a fragment.
 */

import type { ContextEntity, ContextFragment, ContextSourceKey } from "../../types";

/** Default number of rows any single source contributes. */
export const DEFAULT_SOURCE_LIMIT = 5;

/** Read a string hint by key, or `undefined` when absent/not a string. */
export function hintString(hints: Record<string, unknown>, key: string): string | undefined {
  const value = hints[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Today's work date (`YYYY-MM-DD`), overridable via a `workDate` hint. */
export function resolveWorkDate(hints: Record<string, unknown>): string {
  return hintString(hints, "workDate") ?? new Date().toISOString().slice(0, 10);
}

/** Cap a list and report whether anything was dropped. */
export function clampList<T>(
  items: T[],
  limit = DEFAULT_SOURCE_LIMIT,
): { items: T[]; truncated: boolean } {
  if (items.length <= limit) return { items, truncated: false };
  return { items: items.slice(0, limit), truncated: true };
}

/** Format a duration in seconds as `Xh Ym` (or `Ym` / `0m`). */
export function formatDuration(totalSeconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.round(totalSeconds ?? 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Collapse whitespace and clip a string for a single-line summary. */
export function snippet(text: string | null | undefined, max = 120): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

/** Assemble a {@link ContextFragment}. */
export function fragment(
  source: ContextSourceKey,
  label: string,
  entities: ContextEntity[],
  options: { truncated?: boolean; note?: string } = {},
): ContextFragment {
  return {
    source,
    label,
    entities,
    truncated: options.truncated ?? false,
    note: options.note,
  };
}

/** An empty fragment carrying a note (nothing found, or out of scope). */
export function emptyFragment(
  source: ContextSourceKey,
  label: string,
  note: string,
): ContextFragment {
  return { source, label, entities: [], truncated: false, note };
}

/** De-duplicate rows by `id`, preserving first-seen order. */
export function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

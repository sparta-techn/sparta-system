/**
 * Pure progress maths for End-of-Day reports.
 *
 * Extracted from `hooks.ts` so the manager roll-up and the reports export agree
 * on what "completion" means, and so it stays unit-testable without React or
 * Supabase in the way.
 */
import type { TaskProgressEntry } from "@/features/midday/types";

/** Completed count + weighted completion % (partial counts half) over the plan. */
export function taskCompletion(entries: readonly TaskProgressEntry[]): {
  count: number;
  pct: number;
} {
  if (entries.length === 0) return { count: 0, pct: 0 };
  let weight = 0;
  let done = 0;
  for (const t of entries) {
    if (t.state === "completed") {
      weight += 1;
      done += 1;
    } else if (t.state === "partial") {
      weight += 0.5;
    }
  }
  return { count: done, pct: Math.round((weight / entries.length) * 100) };
}

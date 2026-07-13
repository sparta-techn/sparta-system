/**
 * Composes the full, untruncated body of a submitted report into labelled
 * sections for the review detail view. The queue row only carries a one-line
 * `summary`; these helpers unpack the structured jsonb fields so a manager can
 * read the whole report after clicking through.
 */
import { MOOD_OPTIONS } from "@/features/checkin/types";
import { TASK_STATE_ICON, type TomorrowPlan } from "@/features/eod/types";
import { OUTLOOK_META } from "@/features/midday/types";
import type { DailyReportRow, StatusUpdateRow } from "@/services/reports";

import type { ReviewDetailSection } from "./types";

function section(label: string, body: string): ReviewDetailSection {
  return { label, body };
}

/** Full body of an end-of-day report, empty sections omitted. */
export function reportDetailSections(row: DailyReportRow): ReviewDetailSection[] {
  const sections: ReviewDetailSection[] = [];

  if (row.summary?.trim()) sections.push(section("Summary", row.summary.trim()));

  if (row.completed?.length) {
    sections.push(
      section(
        "Completed",
        row.completed
          .map((t) => `${TASK_STATE_ICON[t.state]} ${t.title}${t.note ? ` — ${t.note}` : ""}`)
          .join("\n"),
      ),
    );
  }

  if (row.in_progress?.length) {
    sections.push(
      section(
        "In progress",
        row.in_progress
          .map((i) => `• ${i.title} (${i.priority}, ETA ${i.eta})${i.notes ? ` — ${i.notes}` : ""}`)
          .join("\n"),
      ),
    );
  }

  if (row.need_from_others?.length) {
    sections.push(
      section(
        "Needs from others",
        row.need_from_others.map((n) => `• ${n.department}: ${n.description}`).join("\n"),
      ),
    );
  }

  const plan = (row.tomorrow_plan ?? {}) as Partial<TomorrowPlan>;
  const planLines = [
    ...(plan.priorities ?? []).map((p) => `Priority: ${p}`),
    ...(plan.tasks ?? []).map((t) => `Task: ${t}`),
    ...(plan.meetings ?? []).map((m) => `Meeting: ${m}`),
    ...(plan.expectedBlockers ?? []).map((b) => `Expected blocker: ${b}`),
  ];
  if (planLines.length) sections.push(section("Tomorrow's plan", planLines.join("\n")));

  const reflection = row.reflection ?? {};
  const reflectionLines = [
    reflection.wentWell ? `Went well: ${reflection.wentWell}` : null,
    reflection.slowedDown ? `Slowed down: ${reflection.slowedDown}` : null,
    reflection.forManager ? `For manager: ${reflection.forManager}` : null,
  ].filter((l): l is string => Boolean(l));
  if (reflectionLines.length) sections.push(section("Reflection", reflectionLines.join("\n")));

  return sections;
}

/** Full body of a morning check-in / midday status update, empty sections omitted. */
export function statusDetailSections(row: StatusUpdateRow): ReviewDetailSection[] {
  const sections: ReviewDetailSection[] = [];

  if (row.main_goal?.trim()) sections.push(section("Main goal", row.main_goal.trim()));
  if (row.current_focus?.trim()) sections.push(section("Current focus", row.current_focus.trim()));
  if (typeof row.progress === "number") sections.push(section("Progress", `${row.progress}%`));
  if (row.outlook) sections.push(section("Outlook", OUTLOOK_META[row.outlook].label));

  const moodLabel = row.mood
    ? (MOOD_OPTIONS.find((m) => m.value === row.mood)?.label ?? row.mood)
    : null;
  if (moodLabel) {
    sections.push(section("Mood", `${moodLabel}${row.mood_note ? ` — ${row.mood_note}` : ""}`));
  } else if (row.mood_note?.trim()) {
    sections.push(section("Mood note", row.mood_note.trim()));
  }

  if (row.priorities?.length) {
    sections.push(
      section("Priorities", row.priorities.map((p) => `• ${p.title} (${p.level})`).join("\n")),
    );
  }

  if (row.task_progress?.length) {
    sections.push(
      section(
        "Task progress",
        row.task_progress
          .map((t) => `${TASK_STATE_ICON[t.state]} ${t.title}${t.note ? ` — ${t.note}` : ""}`)
          .join("\n"),
      ),
    );
  }

  if (row.blockers?.length) {
    sections.push(
      section(
        "Blockers",
        row.blockers.map((b) => `• ${b.label}${b.note ? ` — ${b.note}` : ""}`).join("\n"),
      ),
    );
  }

  return sections;
}

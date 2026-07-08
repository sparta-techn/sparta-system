import { CheckCircle2, Target } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { MOCK_DEPARTMENTS, MOCK_EMPLOYEES, MOCK_PLANNED_TASKS } from "../mock-data";
import { EFFORT_META, MOOD_OPTIONS, type CheckInDraft } from "../types";

interface Props {
  draft: CheckInDraft;
}

export function CheckInSummary({ draft }: Props) {
  const mood = MOOD_OPTIONS.find((m) => m.value === draft.mood);
  const dept = MOCK_DEPARTMENTS.find((d) => d.id === draft.help.departmentId);
  const emp = MOCK_EMPLOYEES.find((e) => e.id === draft.help.employeeId);
  const selectedTasks = MOCK_PLANNED_TASKS.filter((t) => draft.taskIds.includes(t.id));

  return (
    <div className="space-y-5">
      <Section title="Mood">
        {mood ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {mood.emoji}
            </span>
            <StatusBadge tone={mood.tone} label={mood.label} />
            {draft.moodNote ? (
              <p className="text-sm text-muted-foreground">“{draft.moodNote}”</p>
            ) : null}
          </div>
        ) : (
          <Empty>Not set</Empty>
        )}
      </Section>

      <Section title="Main goal">
        {draft.mainGoal ? (
          <div className="flex items-start gap-2 rounded-lg border bg-card p-3">
            <Target className="mt-0.5 size-4 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">{draft.mainGoal}</p>
          </div>
        ) : (
          <Empty>No main goal entered</Empty>
        )}
      </Section>

      <Section title={`Priorities (${draft.priorities.length})`}>
        {draft.priorities.length === 0 ? (
          <Empty>None</Empty>
        ) : (
          <ol className="space-y-1.5">
            {draft.priorities.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5 text-sm"
              >
                <span className="font-display tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate font-medium text-foreground">
                  {p.title || <em className="text-muted-foreground">untitled</em>}
                </span>
                <StatusBadge tone="neutral" label={p.level} size="sm" withDot={false} />
                <span className="text-xs text-muted-foreground">{EFFORT_META[p.effort].label}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={`Tasks (${selectedTasks.length})`}>
        {selectedTasks.length === 0 ? (
          <Empty>No tasks selected</Empty>
        ) : (
          <ul className="space-y-1.5">
            {selectedTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm"
              >
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                <span className="font-mono text-[11px] text-muted-foreground">{t.id}</span>
                <span className="flex-1 truncate font-medium text-foreground">{t.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Expected blockers (${draft.blockers.length})`}>
        {draft.blockers.length === 0 ? (
          <Empty>None</Empty>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {draft.blockers.map((b) => (
              <li key={b.id}>
                <StatusBadge tone="warning" label={b.label || "Custom blocker"} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Help request">
        {!draft.help.enabled ? (
          <Empty>Not requested</Empty>
        ) : (
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="font-medium text-foreground">
              {dept?.name ?? "—"} · {emp?.name ?? "—"}
            </p>
            {draft.help.description ? (
              <p className="mt-1 text-muted-foreground">{draft.help.description}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {draft.help.priority ? <span>Priority: {draft.help.priority}</span> : null}
              {draft.help.desiredDate ? <span>Needed by: {draft.help.desiredDate}</span> : null}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

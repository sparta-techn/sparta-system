import { CheckCircle2, CircleDot, Link2, Target, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { hrQueries } from "@/features/hr/queries";

import { OUTLOOK_META, TASK_PROGRESS_META, type MiddayDraft } from "../types";

export function MiddaySummary({ draft }: { draft: MiddayDraft }) {
  const outlook = draft.outlook ? OUTLOOK_META[draft.outlook] : null;
  // Live directory: `departmentId` holds the dept name, `employeeId` an HR id.
  const { data: employees = [] } = useQuery(hrQueries.employees());
  const deptName = draft.help.departmentId ?? "";
  const emp = employees.find((e) => e.id === draft.help.employeeId);
  const completed = draft.taskProgress.filter((t) => t.state === "completed");
  const partial = draft.taskProgress.filter((t) => t.state === "partial");

  return (
    <div className="space-y-5">
      <Section title="Overall progress">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Today's plan</span>
            <span className="font-display text-2xl tabular-nums text-primary">
              {draft.progress}%
            </span>
          </div>
          <Progress value={draft.progress} className="mt-2 h-2" />
        </div>
      </Section>

      <Section title={`Completed work (${completed.length} done · ${partial.length} partial)`}>
        {draft.taskProgress.length === 0 ? (
          <Empty>No tasks tracked this morning.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {draft.taskProgress.map((t) => (
              <li
                key={t.taskId}
                className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm"
              >
                {t.state === "completed" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleDot className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="font-mono text-[11px] text-muted-foreground">{t.taskId}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {t.title}
                </span>
                <StatusBadge
                  tone={TASK_PROGRESS_META[t.state].tone}
                  label={TASK_PROGRESS_META[t.state].label}
                  size="sm"
                  withDot={false}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Current focus">
        {draft.currentFocus ? (
          <div className="flex items-start gap-2 rounded-lg border bg-card p-3">
            <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">{draft.currentFocus}</p>
          </div>
        ) : (
          <Empty>Not set</Empty>
        )}
      </Section>

      <Section title={`Blockers (${draft.blockerLinks.length})`}>
        {draft.blockerLinks.length === 0 && !draft.newBlockerNotes ? (
          <Empty>None pinned</Empty>
        ) : (
          <ul className="space-y-1.5">
            {draft.blockerLinks.map((b) => (
              <li
                key={b.dependencyId}
                className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm"
              >
                <Link2 className="size-4 shrink-0 text-warning" aria-hidden />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {b.dependencyId}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{b.titleSnapshot}</span>
                {b.resolved ? (
                  <StatusBadge status="resolved" size="sm" />
                ) : (
                  <StatusBadge status="blocked" size="sm" />
                )}
              </li>
            ))}
            {draft.newBlockerNotes ? (
              <li className="rounded-lg border bg-card p-2.5 text-sm text-muted-foreground">
                {draft.newBlockerNotes}
              </li>
            ) : null}
          </ul>
        )}
      </Section>

      <Section title="Help request">
        {!draft.help.enabled ? (
          <Empty>Not requested</Empty>
        ) : (
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="font-medium text-foreground">
              {deptName || "—"} · {emp?.name ?? "—"}
            </p>
            {draft.help.description ? (
              <p className="mt-1 text-muted-foreground">{draft.help.description}</p>
            ) : null}
            {draft.help.priority ? (
              <p className="mt-2 text-xs text-muted-foreground">Priority: {draft.help.priority}</p>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="End-of-day outlook">
        {outlook ? (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <TrendingUp className="size-4 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{outlook.label}</p>
              <p className="text-xs text-muted-foreground">{outlook.description}</p>
            </div>
            <StatusBadge tone={outlook.tone} label={outlook.label} size="sm" withDot={false} />
          </div>
        ) : (
          <Empty>Not selected</Empty>
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

import {
  CheckCircle2,
  CircleDot,
  Clock,
  Coffee,
  Link2,
  ListChecks,
  MessageCircle,
  Sparkles,
  Target,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { NEED_DEPARTMENTS } from "../types";
import type { EodDraft, WorkSessionSummary } from "../types";
import { TASK_PROGRESS_META } from "@/features/midday/types";

interface Props {
  draft: EodDraft;
  sessionSummary: WorkSessionSummary;
}

export function EodSummary({ draft, sessionSummary }: Props) {
  const completed = draft.completed.filter((t) => t.state === "completed");
  const partial = draft.completed.filter((t) => t.state === "partial");

  return (
    <div className="space-y-5">
      <Section title="Today's summary" icon={Sparkles}>
        {draft.summary ? (
          <p className="rounded-lg border bg-card p-3 text-sm leading-relaxed text-foreground">
            {draft.summary}
          </p>
        ) : (
          <Empty>Required — add a short summary before submitting.</Empty>
        )}
      </Section>

      <Section
        title={`Completed today (${completed.length} done · ${partial.length} partial)`}
        icon={CheckCircle2}
      >
        {draft.completed.length === 0 ? (
          <Empty>No planned tasks tracked.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {draft.completed.map((t) => (
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

      <Section title={`Still in progress (${draft.inProgress.length})`} icon={Clock}>
        {draft.inProgress.length === 0 ? (
          <Empty>Nothing carried over.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {draft.inProgress.map((item) => (
              <li key={item.id} className="rounded-lg border bg-card p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {item.title}
                  </span>
                  <StatusBadge
                    tone={priorityTone(item.priority)}
                    label={item.priority}
                    size="sm"
                    withDot={false}
                  />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ETA: <span className="text-foreground">{item.eta || "—"}</span>
                </p>
                {item.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Open dependencies (${draft.openDependencies.length})`} icon={Link2}>
        {draft.openDependencies.length === 0 ? (
          <Empty>No open dependencies on your side.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {draft.openDependencies.map((d) => (
              <li
                key={d.dependencyId}
                className="flex items-start gap-2 rounded-lg border bg-card p-2.5 text-sm"
              >
                <Link2 className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {d.dependencyId}
                </span>
                <span className="min-w-0 flex-1 text-foreground">
                  <span className="block truncate">{d.titleSnapshot}</span>
                  {d.note ? (
                    <span className="block text-xs text-muted-foreground">{d.note}</span>
                  ) : null}
                </span>
                {d.resolvedNow ? (
                  <StatusBadge status="resolved" size="sm" />
                ) : (
                  <StatusBadge status="blocked" size="sm" />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={`Need from others tomorrow (${draft.needFromOthers.length})`}
        icon={MessageCircle}
      >
        {draft.needFromOthers.length === 0 ? (
          <Empty>No requests routed.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {draft.needFromOthers.map((n) => (
              <li key={n.id} className="rounded-lg border bg-card p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge tone="info" label={n.department} size="sm" withDot={false} />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {n.description || "—"}
                  </span>
                  <StatusBadge
                    tone={priorityTone(n.priority)}
                    label={n.priority}
                    size="sm"
                    withDot={false}
                  />
                </div>
                {n.dueDate ? (
                  <p className="mt-1 text-xs text-muted-foreground">Due: {n.dueDate}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {/* Reference: NEED_DEPARTMENTS = {NEED_DEPARTMENTS.length} */}
        <span className="sr-only">{NEED_DEPARTMENTS.length} departments available</span>
      </Section>

      <Section title="Tomorrow's plan" icon={Target}>
        <div className="grid gap-2 sm:grid-cols-2">
          <PlanBlock label="Priorities" items={draft.tomorrow.priorities} required />
          <PlanBlock label="Tasks" items={draft.tomorrow.tasks} />
          <PlanBlock label="Meetings" items={draft.tomorrow.meetings} />
          <PlanBlock label="Expected blockers" items={draft.tomorrow.expectedBlockers} />
        </div>
      </Section>

      <Section title="Reflection" icon={MessageCircle}>
        <ReflectionLine label="Went well" value={draft.reflection.wentWell} />
        <ReflectionLine label="Slowed me down" value={draft.reflection.slowedDown} />
        <ReflectionLine label="For my manager" value={draft.reflection.forManager} />
      </Section>

      <Section title="Work session" icon={ListChecks}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Kv label="Check-in" value={sessionSummary.checkIn ?? "—"} />
          <Kv label="Check-out (est.)" value={sessionSummary.checkOut ?? "—"} />
          <Kv label="Worked" value={fmt(sessionSummary.workedMinutes)} />
          <Kv label="Breaks" value={fmt(sessionSummary.breakMinutes)} icon={Coffee} />
          <Kv
            label="Morning check-in"
            value={sessionSummary.morningCheckInDone ? "Done" : "Skipped"}
          />
          <Kv label="Midday status" value={sessionSummary.middayStatusDone ? "Done" : "Skipped"} />
          <Kv label="Dependencies created" value={String(sessionSummary.dependenciesCreated)} />
          <Kv label="Dependencies resolved" value={String(sessionSummary.dependenciesResolved)} />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function PlanBlock({
  label,
  items,
  required,
}: {
  label: string;
  items: string[];
  required?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4 text-sm text-foreground">
          {items.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReflectionLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border bg-card p-2.5 text-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-foreground">{value}</p>
    </div>
  );
}

function Kv({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Coffee }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {label}
      </span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function fmt(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

function priorityTone(p: string): "neutral" | "info" | "warning" | "danger" {
  if (p === "urgent") return "danger";
  if (p === "high") return "warning";
  if (p === "medium") return "info";
  return "neutral";
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudUpload,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { getSubmission as getMorningSubmission } from "@/features/checkin/store";
import { getMiddaySubmission } from "@/features/midday/store";
import { usePlannedTasks, usePlannedTasksByIds } from "@/features/checkin/planned-tasks";
import type { PriorityLevel } from "@/features/checkin/types";
import { useDependencies } from "@/features/dependencies/store";
import { CURRENT_USER_ID } from "@/features/dependencies/mock-data";
import { hrQueries } from "@/features/hr/queries";
import {
  TASK_PROGRESS_META,
  type TaskProgressEntry,
  type TaskProgressState,
} from "@/features/midday/types";

import { EodSummary } from "./eod-summary";
import {
  clearEodDraft,
  getEodDraft,
  setEodDraft as persistDraft,
  submitEod,
  updateEodSubmission,
} from "../store";
import {
  EMPTY_EOD_DRAFT,
  type EodDraft,
  type EodSubmission,
  type InProgressItem,
  type NeedFromOthersItem,
  type OpenDependencyEntry,
  type TomorrowPlan,
  type WorkSessionSummary,
} from "../types";

type StepId =
  | "summary"
  | "completed"
  | "in_progress"
  | "open_deps"
  | "need"
  | "tomorrow"
  | "reflection"
  | "review";

const STEPS: { id: StepId; short: string; label: string; hint: string }[] = [
  {
    id: "summary",
    short: "Summary",
    label: "Today's summary",
    hint: "One short paragraph. Max 500 characters.",
  },
  {
    id: "completed",
    short: "Completed",
    label: "Completed today",
    hint: "Mark each planned task.",
  },
  {
    id: "in_progress",
    short: "In progress",
    label: "Still in progress",
    hint: "What's carrying over to tomorrow.",
  },
  {
    id: "open_deps",
    short: "Dependencies",
    label: "Open dependencies",
    hint: "Pin or resolve what's still blocking.",
  },
  {
    id: "need",
    short: "Need",
    label: "Need from others tomorrow",
    hint: "Route specific asks. Optional.",
  },
  {
    id: "tomorrow",
    short: "Tomorrow",
    label: "Tomorrow's plan",
    hint: "Set the next day up before you close out.",
  },
  {
    id: "reflection",
    short: "Reflection",
    label: "Daily reflection",
    hint: "Optional. Two lines is plenty.",
  },
  { id: "review", short: "Review", label: "Review & submit", hint: "Final check before checkout." },
];

const PRIORITIES: PriorityLevel[] = ["low", "medium", "high", "urgent"];

interface Props {
  existing?: EodSubmission | null;
  sessionSummary: WorkSessionSummary;
}

export function EodWizard({ existing, sessionSummary }: Props) {
  const navigate = useNavigate();
  const isEdit = !!existing;

  const [draft, setDraftState] = useState<EodDraft>(() => {
    if (existing) {
      const { id: _i, submittedAt: _a, workDate: _w, sessionSummary: _s, ...rest } = existing;
      return rest;
    }
    const saved = getEodDraft();
    if (saved.summary || saved.completed.length || saved.inProgress.length) return saved;
    return seedDraft();
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showErrors, setShowErrors] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (isEdit) return;
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      persistDraft(draft);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
    }, 500);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft, isEdit]);

  const step = STEPS[stepIdx];
  const stepperPct = Math.round(((stepIdx + 1) / STEPS.length) * 100);

  const validation = useMemo(() => {
    const errors: Partial<Record<StepId, string>> = {};
    if (!draft.summary.trim()) errors.summary = "Today's summary is required.";
    const totalPlan =
      draft.tomorrow.priorities.length +
      draft.tomorrow.tasks.length +
      draft.tomorrow.meetings.length;
    if (totalPlan === 0 || draft.tomorrow.priorities.length === 0)
      errors.tomorrow = "Add at least one priority for tomorrow.";
    return errors;
  }, [draft]);

  const canSubmit = Object.keys(validation).length === 0;

  function setField<K extends keyof EodDraft>(key: K, value: EodDraft[K]) {
    setDraftState((d) => ({ ...d, [key]: value }));
  }

  function next() {
    if (step.id === "summary" && validation.summary) {
      setShowErrors(true);
      return;
    }
    if (step.id === "tomorrow" && validation.tomorrow) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function back() {
    setShowErrors(false);
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  function handleSubmit() {
    if (!canSubmit) {
      setShowErrors(true);
      toast.error("Add a summary and at least one priority for tomorrow.");
      return;
    }
    if (isEdit && existing) {
      updateEodSubmission(draft);
      toast.success("End-of-day report updated.");
    } else {
      submitEod(draft, sessionSummary);
      toast.success("Report submitted. Work session ready for checkout.");
    }
    navigate({ to: "/app" });
  }

  function handleCancel() {
    if (!isEdit) clearEodDraft();
    navigate({ to: "/app" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div>
          <Progress value={stepperPct} className="h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            Step {stepIdx + 1} of {STEPS.length}
          </p>
        </div>
        <nav aria-label="End-of-day report steps">
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const active = i === stepIdx;
              const done = i < stepIdx;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStepIdx(i)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition",
                      active
                        ? "bg-primary-soft text-primary font-medium"
                        : "text-foreground hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                        done
                          ? "bg-success text-success-foreground"
                          : active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="size-3" /> : i + 1}
                    </span>
                    <span className="truncate">{s.short}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <AutosaveIndicator state={saveState} isEdit={isEdit} />
      </aside>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">{step.label}</CardTitle>
          <CardDescription>{step.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step.id === "summary" ? (
            <SummaryStep
              value={draft.summary}
              onChange={(v) => setField("summary", v)}
              error={showErrors ? validation.summary : undefined}
            />
          ) : null}

          {step.id === "completed" ? (
            <CompletedStep value={draft.completed} onChange={(v) => setField("completed", v)} />
          ) : null}

          {step.id === "in_progress" ? (
            <InProgressStep value={draft.inProgress} onChange={(v) => setField("inProgress", v)} />
          ) : null}

          {step.id === "open_deps" ? (
            <OpenDepsStep
              value={draft.openDependencies}
              onChange={(v) => setField("openDependencies", v)}
            />
          ) : null}

          {step.id === "need" ? (
            <NeedStep
              value={draft.needFromOthers}
              onChange={(v) => setField("needFromOthers", v)}
            />
          ) : null}

          {step.id === "tomorrow" ? (
            <TomorrowStep
              value={draft.tomorrow}
              onChange={(v) => setField("tomorrow", v)}
              error={showErrors ? validation.tomorrow : undefined}
            />
          ) : null}

          {step.id === "reflection" ? (
            <ReflectionStep value={draft.reflection} onChange={(v) => setField("reflection", v)} />
          ) : null}

          {step.id === "review" ? (
            <EodSummary draft={draft} sessionSummary={sessionSummary} />
          ) : null}
        </CardContent>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={back} disabled={stepIdx === 0}>
              <ArrowLeft /> Back
            </Button>
            {stepIdx < STEPS.length - 1 ? (
              <Button type="button" onClick={next}>
                Next <ArrowRight />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                <Check /> {isEdit ? "Save changes" : "Submit & ready for checkout"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────── Steps ────────────────────────────────────────────────────────

function SummaryStep({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="eod-summary">
        Today's summary <span className="text-destructive">*</span>
      </Label>
      <Textarea
        id="eod-summary"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Completed authentication module and reviewed PR #42. Login is ready for QA."
        aria-invalid={!!error}
        aria-describedby={error ? "eod-summary-err" : "eod-summary-hint"}
      />
      <div className="flex items-center justify-between text-xs">
        {error ? (
          <p id="eod-summary-err" className="flex items-center gap-1 text-destructive">
            <AlertCircle className="size-3.5" /> {error}
          </p>
        ) : (
          <p id="eod-summary-hint" className="text-muted-foreground">
            Write it for tomorrow's you — what would you want to know?
          </p>
        )}
      </div>
    </div>
  );
}

function CompletedStep({
  value,
  onChange,
}: {
  value: TaskProgressEntry[];
  onChange: (v: TaskProgressEntry[]) => void;
}) {
  // Live tasks: the morning selection resolved against the real tasks store,
  // falling back to the current user's open work when there was no check-in.
  const morning = typeof window === "undefined" ? null : getMorningSubmission();
  const mine = usePlannedTasks();
  const fromMorning = usePlannedTasksByIds(morning?.taskIds ?? []);
  const planned = morning?.taskIds?.length ? fromMorning : mine;

  // Backfill a progress entry for every planned task (defaults to not_started),
  // even before the user touches it — mirrors the former seed, but hydration-safe.
  useEffect(() => {
    const missing = planned.filter((p) => !value.some((e) => e.taskId === p.id));
    if (missing.length === 0) return;
    onChange([
      ...value,
      ...missing.map((p) => ({
        taskId: p.id,
        title: p.title,
        project: p.project,
        state: "not_started" as TaskProgressState,
      })),
    ]);
  }, [planned, value, onChange]);

  function setEntry(taskId: string, patch: Partial<TaskProgressEntry>) {
    const existing = value.find((e) => e.taskId === taskId);
    const task = planned.find((p) => p.id === taskId);
    if (!task) return;
    const base: TaskProgressEntry = existing ?? {
      taskId,
      title: task.title,
      project: task.project,
      state: "not_started",
    };
    const merged = { ...base, ...patch };
    const others = value.filter((e) => e.taskId !== taskId);
    onChange([...others, merged]);
  }

  if (planned.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No tasks were planned this morning. Skip ahead.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {planned.map((task) => {
        const entry =
          value.find((e) => e.taskId === task.id) ??
          ({
            taskId: task.id,
            title: task.title,
            project: task.project,
            state: "not_started",
          } as TaskProgressEntry);
        return (
          <li key={task.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] text-muted-foreground">{task.id}</p>
                <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.project}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {(Object.keys(TASK_PROGRESS_META) as TaskProgressState[]).map((state) => {
                  const meta = TASK_PROGRESS_META[state];
                  const active = entry.state === state;
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setEntry(task.id, { state })}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition",
                        active
                          ? state === "completed"
                            ? "bg-success text-success-foreground ring-success"
                            : state === "partial"
                              ? "bg-warning text-warning-foreground ring-warning"
                              : "bg-muted text-foreground ring-border"
                          : "bg-background text-muted-foreground ring-border hover:bg-accent",
                      )}
                      aria-pressed={active}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {entry.state !== "not_started" ? (
              <Textarea
                rows={2}
                value={entry.note ?? ""}
                onChange={(e) => setEntry(task.id, { note: e.target.value })}
                placeholder="Optional note — e.g. PR open, blocked on review."
                className="mt-2"
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function InProgressStep({
  value,
  onChange,
}: {
  value: InProgressItem[];
  onChange: (v: InProgressItem[]) => void;
}) {
  function add() {
    onChange([...value, { id: `ip_${Date.now()}`, title: "", priority: "medium", eta: "" }]);
  }
  function patch(id: string, p: Partial<InProgressItem>) {
    onChange(value.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }
  function remove(id: string) {
    onChange(value.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          Nothing carrying over? Skip ahead.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((item) => (
            <li key={item.id} className="space-y-2 rounded-lg border bg-card p-3">
              <div className="flex items-start gap-2">
                <Input
                  value={item.title}
                  onChange={(e) => patch(item.id, { title: e.target.value })}
                  placeholder="e.g. Finish reports table refactor"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(item.id)}
                  aria-label="Remove"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={item.priority}
                  onValueChange={(v) => patch(item.id, { priority: v as PriorityLevel })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={item.eta}
                  onChange={(e) => patch(item.id, { eta: e.target.value })}
                  placeholder="ETA, e.g. Tomorrow EOD"
                />
              </div>
              <Textarea
                rows={2}
                value={item.notes ?? ""}
                onChange={(e) => patch(item.id, { notes: e.target.value })}
                placeholder="Optional notes."
              />
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={add}>
        <Plus className="size-4" /> Add unfinished work
      </Button>
    </div>
  );
}

function OpenDepsStep({
  value,
  onChange,
}: {
  value: OpenDependencyEntry[];
  onChange: (v: OpenDependencyEntry[]) => void;
}) {
  const deps = useDependencies();
  const myOpen = deps.filter(
    (d) =>
      d.requesterId === CURRENT_USER_ID &&
      !["resolved", "closed", "cancelled", "rejected"].includes(d.state),
  );

  function entryFor(id: string): OpenDependencyEntry | undefined {
    return value.find((b) => b.dependencyId === id);
  }
  function toggle(dep: (typeof deps)[number]) {
    const existing = entryFor(dep.id);
    if (existing) {
      onChange(value.filter((b) => b.dependencyId !== dep.id));
    } else {
      onChange([...value, { dependencyId: dep.id, titleSnapshot: dep.title }]);
    }
  }
  function patch(id: string, p: Partial<OpenDependencyEntry>) {
    onChange(value.map((b) => (b.dependencyId === id ? { ...b, ...p } : b)));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Your open dependencies
        </p>
        {myOpen.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Nothing waiting on others. Nice.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {myOpen.map((dep) => {
              const linked = entryFor(dep.id);
              return (
                <li
                  key={dep.id}
                  className={cn(
                    "rounded-lg border bg-card p-3 text-sm transition",
                    linked && "border-primary/40 bg-primary-soft/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(dep)}
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition",
                        linked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input text-transparent hover:border-primary",
                      )}
                      aria-label={linked ? "Unlink dependency" : "Pin dependency"}
                    >
                      <Check className="size-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{dep.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {dep.department} · {dep.id}
                      </p>
                    </div>
                    {linked ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={linked.resolvedNow ? "outline" : "ghost"}
                        onClick={() => patch(dep.id, { resolvedNow: !linked.resolvedNow })}
                      >
                        {linked.resolvedNow ? (
                          <>
                            <CheckCircle2 className="size-3.5" /> Resolved
                          </>
                        ) : (
                          "Mark resolved"
                        )}
                      </Button>
                    ) : null}
                  </div>
                  {linked ? (
                    <Textarea
                      rows={2}
                      value={linked.note ?? ""}
                      onChange={(e) => patch(dep.id, { note: e.target.value })}
                      placeholder="Quick note — current state, who's needed."
                      className="mt-2"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button type="button" variant="outline" size="sm" asChild>
        <a href="/app/dependencies?new=1" target="_blank" rel="noreferrer">
          <Plus className="size-3.5" /> Create new dependency
        </a>
      </Button>
    </div>
  );
}

function NeedStep({
  value,
  onChange,
}: {
  value: NeedFromOthersItem[];
  onChange: (v: NeedFromOthersItem[]) => void;
}) {
  const deps = useDependencies();
  // Live org departments (Supabase-backed) — not a fixed sample list.
  const { data: departments = [] } = useQuery(hrQueries.departments());
  function add() {
    onChange([
      ...value,
      {
        id: `need_${Date.now()}`,
        department: departments[0] ?? "",
        description: "",
        priority: "medium",
      },
    ]);
  }
  function patch(id: string, p: Partial<NeedFromOthersItem>) {
    onChange(value.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }
  function remove(id: string) {
    onChange(value.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          Nothing required from others tomorrow.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((item) => (
            <li key={item.id} className="space-y-2 rounded-lg border bg-card p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Select
                  value={item.department}
                  onValueChange={(v) => patch(item.id, { department: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={item.priority}
                  onValueChange={(v) => patch(item.id, { priority: v as PriorityLevel })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(item.id)}
                  aria-label="Remove"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea
                rows={2}
                value={item.description}
                onChange={(e) => patch(item.id, { description: e.target.value })}
                placeholder="Specific ask — e.g. Lock pagination shape for /v2/orders."
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={item.dueDate ?? ""}
                  onChange={(e) => patch(item.id, { dueDate: e.target.value || undefined })}
                />
                <Select
                  value={item.relatedDependencyId ?? "_none"}
                  onValueChange={(v) =>
                    patch(item.id, { relatedDependencyId: v === "_none" ? undefined : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Related dependency (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {deps.slice(0, 30).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.id} · {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={add}>
        <Plus className="size-4" /> Add request
      </Button>
    </div>
  );
}

function TomorrowStep({
  value,
  onChange,
  error,
}: {
  value: TomorrowPlan;
  onChange: (v: TomorrowPlan) => void;
  error?: string;
}) {
  function setList(key: keyof TomorrowPlan, items: string[]) {
    onChange({ ...value, [key]: items });
  }

  return (
    <div className="space-y-4">
      <ChipListEditor
        label="Top priorities"
        required
        placeholder="Top priority for tomorrow"
        items={value.priorities}
        onChange={(v) => setList("priorities", v)}
      />
      <ChipListEditor
        label="Expected tasks"
        placeholder="Task or work item"
        items={value.tasks}
        onChange={(v) => setList("tasks", v)}
      />
      <ChipListEditor
        label="Expected meetings"
        placeholder="Meeting (with time if known)"
        items={value.meetings}
        onChange={(v) => setList("meetings", v)}
      />
      <ChipListEditor
        label="Expected blockers"
        placeholder="Anything that could slow you down"
        items={value.expectedBlockers}
        onChange={(v) => setList("expectedBlockers", v)}
      />
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      ) : null}
    </div>
  );
}

function ChipListEditor({
  label,
  placeholder,
  items,
  onChange,
  required,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (v: string[]) => void;
  required?: boolean;
}) {
  const [text, setText] = useState("");
  function add() {
    const v = text.trim();
    if (!v) return;
    onChange([...items, v]);
    setText("");
  }
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {items.map((it, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs"
            >
              <span className="text-foreground">{it}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${it}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ReflectionStep({
  value,
  onChange,
}: {
  value: { wentWell?: string; slowedDown?: string; forManager?: string };
  onChange: (v: typeof value) => void;
}) {
  function set(k: keyof typeof value, v: string) {
    onChange({ ...value, [k]: v });
  }
  return (
    <div className="space-y-3">
      <Field
        id="went-well"
        label="What went well today?"
        value={value.wentWell ?? ""}
        onChange={(v) => set("wentWell", v)}
        placeholder="A small win, a smooth flow, a kind teammate."
      />
      <Field
        id="slowed-down"
        label="What slowed you down?"
        value={value.slowedDown ?? ""}
        onChange={(v) => set("slowedDown", v)}
        placeholder="Friction, context-switches, missing inputs."
      />
      <Field
        id="for-manager"
        label="Anything your manager should know?"
        value={value.forManager ?? ""}
        onChange={(v) => set("forManager", v)}
        placeholder="Surface it now — don't wait for a 1:1."
      />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─────────── Helpers ──────────────────────────────────────────────────────

function seedDraft(): EodDraft {
  if (typeof window === "undefined") return EMPTY_EOD_DRAFT;
  // Prefer the midday progress snapshot; otherwise `CompletedStep` resolves the
  // morning selection live from the tasks store (hydration-safe), so we start empty.
  const midday = getMiddaySubmission();
  const completed: TaskProgressEntry[] = midday?.taskProgress?.length ? midday.taskProgress : [];
  return { ...EMPTY_EOD_DRAFT, completed };
}

function AutosaveIndicator({
  state,
  isEdit,
}: {
  state: "idle" | "saving" | "saved";
  isEdit: boolean;
}) {
  if (isEdit)
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Edits are saved on submit.
      </p>
    );
  if (state === "saving")
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving draft…
      </p>
    );
  if (state === "saved")
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-success">
        <CloudUpload className="size-3" /> Draft saved
      </p>
    );
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Sparkles className="size-3" /> Draft autosaves as you type.
    </p>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  CloudUpload,
  Link2,
  Loader2,
  Plus,
  Target,
  TrendingUp,
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
import { Slider } from "@/components/ui/slider";
import { StatusBadge } from "@/components/status-badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { getSubmission as getMorningSubmission } from "@/features/checkin/store";
import { usePlannedTasks, usePlannedTasksByIds } from "@/features/checkin/planned-tasks";
import type { PriorityLevel } from "@/features/checkin/types";
import { useDependencies } from "@/features/dependencies/store";
import { CURRENT_USER_ID } from "@/features/dependencies/mock-data";
import { hrQueries } from "@/features/hr/queries";

import { MiddaySummary } from "./midday-summary";
import {
  clearMiddayDraft,
  getMiddayDraft,
  setMiddayDraft as persistDraft,
  submitMidday,
  updateMiddaySubmission,
} from "../store";
import {
  EMPTY_MIDDAY_DRAFT,
  OUTLOOK_META,
  TASK_PROGRESS_META,
  type EndOfDayOutlook,
  type MiddayDraft,
  type MiddaySubmission,
  type TaskProgressEntry,
  type TaskProgressState,
} from "../types";

type StepId = "progress" | "completed" | "focus" | "blockers" | "help" | "outlook" | "review";

const STEPS: { id: StepId; short: string; label: string; hint: string }[] = [
  {
    id: "progress",
    short: "Progress",
    label: "Overall progress",
    hint: "How far along is the day's plan?",
  },
  {
    id: "completed",
    short: "Completed",
    label: "Completed since morning",
    hint: "Mark each planned task.",
  },
  {
    id: "focus",
    short: "Focus",
    label: "Current focus",
    hint: "One sentence — what are you on right now?",
  },
  {
    id: "blockers",
    short: "Blockers",
    label: "Current blockers",
    hint: "Pin open dependencies or note a new one.",
  },
  { id: "help", short: "Help", label: "Need assistance?", hint: "Route a specific ask. Optional." },
  {
    id: "outlook",
    short: "Outlook",
    label: "End-of-day outlook",
    hint: "Are you on track to finish today's plan?",
  },
  {
    id: "review",
    short: "Review",
    label: "Review & submit",
    hint: "One last look before you ship the update.",
  },
];

const LEVELS: PriorityLevel[] = ["low", "medium", "high", "urgent"];
const OUTLOOK_ORDER: EndOfDayOutlook[] = [
  "on_track",
  "need_more_time",
  "blocked",
  "need_manager_help",
];

interface Props {
  existing?: MiddaySubmission | null;
}

export function MiddayWizard({ existing }: Props) {
  const navigate = useNavigate();
  const isEdit = !!existing;

  const [draft, setDraftState] = useState<MiddayDraft>(() => {
    if (existing) {
      const { id: _id, submittedAt: _at, workDate: _wd, ...rest } = existing;
      return rest;
    }
    const saved = getMiddayDraft();
    if (saved.currentFocus || saved.taskProgress.length || saved.outlook) return saved;
    return seedDraftFromMorning();
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
    if (typeof draft.progress !== "number") errors.progress = "Progress is required.";
    if (!draft.currentFocus.trim()) errors.focus = "Current focus is required.";
    if (!draft.outlook) errors.outlook = "Pick an end-of-day outlook.";
    return errors;
  }, [draft]);

  const canSubmit = Object.keys(validation).length === 0;

  function setField<K extends keyof MiddayDraft>(key: K, value: MiddayDraft[K]) {
    setDraftState((d) => ({ ...d, [key]: value }));
  }

  function next() {
    if (step.id === "focus" && validation.focus) {
      setShowErrors(true);
      return;
    }
    if (step.id === "outlook" && validation.outlook) {
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
      toast.error("Please fill in progress, focus, and outlook.");
      return;
    }
    if (isEdit && existing) {
      updateMiddaySubmission(draft);
      toast.success("Midday status updated.");
    } else {
      submitMidday(draft);
      toast.success("Midday status submitted.");
    }
    navigate({ to: "/app" });
  }

  function handleCancel() {
    if (!isEdit) clearMiddayDraft();
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
        <nav aria-label="Midday status steps">
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
          {step.id === "progress" ? (
            <ProgressStep value={draft.progress} onChange={(v) => setField("progress", v)} />
          ) : null}

          {step.id === "completed" ? (
            <CompletedStep
              value={draft.taskProgress}
              onChange={(v) => setField("taskProgress", v)}
            />
          ) : null}

          {step.id === "focus" ? (
            <div className="space-y-1.5">
              <Label htmlFor="focus">
                Current focus <span className="text-destructive">*</span>
              </Label>
              <Input
                id="focus"
                value={draft.currentFocus}
                onChange={(e) => setField("currentFocus", e.target.value)}
                placeholder="e.g. Implementing authentication middleware"
                maxLength={140}
                aria-invalid={showErrors && !!validation.focus}
                aria-describedby={validation.focus ? "focus-error" : undefined}
              />
              {showErrors && validation.focus ? (
                <p id="focus-error" className="text-xs text-destructive">
                  {validation.focus}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  One sentence. Specific beats clever.
                </p>
              )}
            </div>
          ) : null}

          {step.id === "blockers" ? (
            <BlockersStep
              value={draft.blockerLinks}
              onChange={(v) => setField("blockerLinks", v)}
              notes={draft.newBlockerNotes}
              onNotesChange={(v) => setField("newBlockerNotes", v)}
            />
          ) : null}

          {step.id === "help" ? (
            <HelpStep value={draft.help} onChange={(v) => setField("help", v)} />
          ) : null}

          {step.id === "outlook" ? (
            <OutlookStep
              value={draft.outlook}
              onChange={(v) => setField("outlook", v)}
              error={showErrors ? validation.outlook : undefined}
            />
          ) : null}

          {step.id === "review" ? <MiddaySummary draft={draft} /> : null}
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
                <Check /> {isEdit ? "Save changes" : "Submit status"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────── Step components ──────────────────────────────────────────────

function ProgressStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-foreground">Overall progress</p>
          <p className="font-display text-3xl tabular-nums text-primary">{value}%</p>
        </div>
        <Progress value={value} className="mt-3 h-3" />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>Just started</span>
          <span>Halfway</span>
          <span>Done</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="progress-slider">Adjust in 10% steps</Label>
        <Slider
          id="progress-slider"
          value={[value]}
          min={0}
          max={100}
          step={10}
          onValueChange={(v) => onChange(v[0] ?? 0)}
          aria-label="Overall progress"
        />
        <div className="flex flex-wrap gap-1.5 pt-2">
          {Array.from({ length: 11 }, (_, i) => i * 10).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                "h-8 min-w-12 rounded-md border px-2 text-xs tabular-nums transition",
                value === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
              aria-pressed={value === p}
            >
              {p}%
            </button>
          ))}
        </div>
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

  // Ensure every planned task has a progress entry (defaults to not_started),
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
        No tasks were planned this morning. Skip to current focus.
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

function BlockersStep({
  value,
  onChange,
  notes,
  onNotesChange,
}: {
  value: { dependencyId: string; titleSnapshot: string; resolved?: boolean }[];
  onChange: (v: { dependencyId: string; titleSnapshot: string; resolved?: boolean }[]) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  const deps = useDependencies();
  // Open dependencies where I am requester (waiting on someone) or blocked.
  const myOpen = deps.filter(
    (d) =>
      d.requesterId === CURRENT_USER_ID &&
      !["resolved", "closed", "cancelled", "rejected"].includes(d.state),
  );

  function toggle(dep: (typeof deps)[number]) {
    const existing = value.find((b) => b.dependencyId === dep.id);
    if (existing) {
      onChange(value.filter((b) => b.dependencyId !== dep.id));
    } else {
      onChange([...value, { dependencyId: dep.id, titleSnapshot: dep.title }]);
    }
  }

  function markResolved(id: string, resolved: boolean) {
    onChange(value.map((b) => (b.dependencyId === id ? { ...b, resolved } : b)));
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
              const linked = value.find((b) => b.dependencyId === dep.id);
              return (
                <li
                  key={dep.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border bg-card p-3 text-sm transition",
                    linked && "border-primary/40 bg-primary-soft/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(dep)}
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition",
                      linked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-transparent hover:border-primary",
                    )}
                    aria-label={linked ? "Unlink blocker" : "Link as blocker"}
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
                      variant={linked.resolved ? "outline" : "ghost"}
                      onClick={() => markResolved(dep.id, !linked.resolved)}
                    >
                      {linked.resolved ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Resolved
                        </>
                      ) : (
                        "Mark resolved"
                      )}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <Label htmlFor="new-blocker">Anything new not yet tracked?</Label>
        <Textarea
          id="new-blocker"
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Short note — you can convert this into a full dependency later."
        />
        <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
          <a href="/app/dependencies?new=1" target="_blank" rel="noreferrer">
            <Plus className="size-3.5" /> Create dependency
          </a>
        </Button>
      </div>
    </div>
  );
}

function HelpStep({
  value,
  onChange,
}: {
  value: {
    enabled: boolean;
    departmentId?: string;
    employeeId?: string;
    description?: string;
    priority?: PriorityLevel;
  };
  onChange: (v: typeof value) => void;
}) {
  function patch(p: Partial<typeof value>) {
    onChange({ ...value, ...p });
  }
  // Live org directory (Supabase-backed). `departmentId` holds the dept name.
  const { data: departments = [] } = useQuery(hrQueries.departments());
  const { data: employees = [] } = useQuery(hrQueries.employees());
  const filtered = value.departmentId
    ? employees.filter((e) => e.department === value.departmentId)
    : employees;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="space-y-0.5">
          <Label htmlFor="help-toggle" className="text-sm font-medium">
            I need assistance
          </Label>
          <p className="text-xs text-muted-foreground">Route a specific ask. Optional.</p>
        </div>
        <Switch
          id="help-toggle"
          checked={value.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
        />
      </div>

      {value.enabled ? (
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="md-help-dept">Department</Label>
            <Select
              value={value.departmentId ?? ""}
              onValueChange={(v) => patch({ departmentId: v, employeeId: undefined })}
            >
              <SelectTrigger id="md-help-dept">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-help-emp">Person</Label>
            <Select value={value.employeeId ?? ""} onValueChange={(v) => patch({ employeeId: v })}>
              <SelectTrigger id="md-help-emp">
                <SelectValue placeholder="Select teammate" />
              </SelectTrigger>
              <SelectContent>
                {filtered.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                    {e.jobTitle && e.jobTitle !== "—" ? ` — ${e.jobTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="md-help-desc">What do you need?</Label>
            <Textarea
              id="md-help-desc"
              rows={3}
              value={value.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="A short, concrete ask works best."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-help-prio">Priority</Label>
            <Select
              value={value.priority ?? ""}
              onValueChange={(v) => patch({ priority: v as PriorityLevel })}
            >
              <SelectTrigger id="md-help-prio">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l[0].toUpperCase() + l.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OutlookStep({
  value,
  onChange,
  error,
}: {
  value: EndOfDayOutlook | null;
  onChange: (v: EndOfDayOutlook) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="End-of-day outlook">
      {OUTLOOK_ORDER.map((id) => {
        const meta = OUTLOOK_META[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition",
              active
                ? "border-primary ring-2 ring-primary/30 bg-primary-soft/40"
                : "hover:border-primary/40 hover:bg-accent/40",
            )}
          >
            <span className="text-xl leading-none" aria-hidden>
              {meta.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{meta.label}</p>
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            </div>
            <StatusBadge
              tone={meta.tone}
              label={active ? "Selected" : "Pick"}
              size="sm"
              withDot={false}
            />
          </button>
        );
      })}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      ) : null}
    </div>
  );
}

// ─────────── Helpers ──────────────────────────────────────────────────────

function seedDraftFromMorning(): MiddayDraft {
  // Task-progress entries are resolved live from the tasks store in
  // `CompletedStep` (hydration-safe), so the initial draft starts empty.
  return { ...EMPTY_MIDDAY_DRAFT };
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
      Draft autosaves as you type.
    </p>
  );
}

// re-exports so dashboard widgets can reuse iconography without circular deps
export const MIDDAY_ICONS = { Target, TrendingUp, CircleDot, Link2, X };

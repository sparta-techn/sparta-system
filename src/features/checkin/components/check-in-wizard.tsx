import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { BlockersEditor } from "./blockers-editor";
import { CheckInSummary } from "./check-in-summary";
import { HelpRequestEditor } from "./help-request-editor";
import { MoodPicker } from "./mood-picker";
import { PrioritiesEditor } from "./priorities-editor";
import { TasksPicker } from "./tasks-picker";

import {
  clearDraft,
  getDraft,
  getSubmission,
  setDraft as persistDraft,
  submitCheckIn,
  updateSubmission,
} from "../store";
import {
  EMPTY_DRAFT,
  type CheckInDraft,
  type CheckInSubmission,
} from "../types";

type StepId = "mood" | "goal" | "priorities" | "tasks" | "blockers" | "help" | "review";

const STEPS: { id: StepId; label: string; short: string }[] = [
  { id: "mood", label: "How are you?", short: "Mood" },
  { id: "goal", label: "Today's main goal", short: "Goal" },
  { id: "priorities", label: "Top priorities", short: "Priorities" },
  { id: "tasks", label: "Planned tasks", short: "Tasks" },
  { id: "blockers", label: "Expected blockers", short: "Blockers" },
  { id: "help", label: "Need help?", short: "Help" },
  { id: "review", label: "Review & submit", short: "Review" },
];

interface Props {
  /** When provided, the wizard opens in edit mode for an existing submission. */
  existing?: CheckInSubmission | null;
}

export function CheckInWizard({ existing }: Props) {
  const navigate = useNavigate();
  const isEdit = !!existing;

  const [draft, setDraftState] = useState<CheckInDraft>(() => {
    if (existing) {
      const { id: _id, submittedAt: _at, workDate: _wd, ...rest } = existing;
      return rest;
    }
    const saved = getDraft();
    return saved.mood || saved.mainGoal || saved.priorities.length
      ? saved
      : EMPTY_DRAFT;
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showErrors, setShowErrors] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Autosave drafts only (not in edit mode — edits commit on submit).
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
  const progress = Math.round(((stepIdx + 1) / STEPS.length) * 100);

  const validation = useMemo(() => {
    const errors: Partial<Record<StepId, string>> = {};
    if (!draft.mainGoal.trim()) errors.goal = "Main goal is required.";
    if (draft.priorities.length === 0)
      errors.priorities = "Add at least one priority.";
    else if (draft.priorities.some((p) => !p.title.trim()))
      errors.priorities = "All priorities need a title.";
    return errors;
  }, [draft]);

  const canSubmit = Object.keys(validation).length === 0;

  function setField<K extends keyof CheckInDraft>(key: K, value: CheckInDraft[K]) {
    setDraftState((d) => ({ ...d, [key]: value }));
  }

  function next() {
    // Hard-gate on required fields when leaving their step
    if (step.id === "goal" && validation.goal) {
      setShowErrors(true);
      return;
    }
    if (step.id === "priorities" && validation.priorities) {
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
      toast.error("Please complete the required fields.");
      return;
    }
    if (isEdit && existing) {
      updateSubmission(draft);
      toast.success("Check-in updated.");
    } else {
      submitCheckIn(draft);
      toast.success("Morning check-in submitted.");
    }
    navigate({ to: "/app" });
  }

  function handleCancel() {
    if (!isEdit) clearDraft();
    navigate({ to: "/app" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div>
          <Progress value={progress} className="h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            Step {stepIdx + 1} of {STEPS.length}
          </p>
        </div>
        <nav aria-label="Check-in steps">
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
          <CardDescription>{describe(step.id)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step.id === "mood" ? (
            <div className="space-y-4">
              <MoodPicker
                value={draft.mood}
                onChange={(m) => setField("mood", m)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="moodNote">
                  Anything you'd like your manager to know?{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="moodNote"
                  rows={3}
                  value={draft.moodNote}
                  onChange={(e) => setField("moodNote", e.target.value)}
                  placeholder="Stays visible to your direct manager."
                  maxLength={500}
                />
              </div>
            </div>
          ) : null}

          {step.id === "goal" ? (
            <div className="space-y-1.5">
              <Label htmlFor="mainGoal">
                Main goal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mainGoal"
                value={draft.mainGoal}
                onChange={(e) => setField("mainGoal", e.target.value)}
                placeholder="e.g. Complete authentication module"
                maxLength={140}
                aria-invalid={showErrors && !!validation.goal}
                aria-describedby={validation.goal ? "goal-error" : undefined}
              />
              {showErrors && validation.goal ? (
                <p id="goal-error" className="text-xs text-destructive">
                  {validation.goal}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  One sentence. What does success look like today?
                </p>
              )}
            </div>
          ) : null}

          {step.id === "priorities" ? (
            <div className="space-y-2">
              <PrioritiesEditor
                value={draft.priorities}
                onChange={(v) => setField("priorities", v)}
              />
              {showErrors && validation.priorities ? (
                <p className="text-xs text-destructive">{validation.priorities}</p>
              ) : null}
            </div>
          ) : null}

          {step.id === "tasks" ? (
            <TasksPicker
              selected={draft.taskIds}
              onChange={(v) => setField("taskIds", v)}
            />
          ) : null}

          {step.id === "blockers" ? (
            <BlockersEditor
              value={draft.blockers}
              onChange={(v) => setField("blockers", v)}
            />
          ) : null}

          {step.id === "help" ? (
            <HelpRequestEditor
              value={draft.help}
              onChange={(v) => setField("help", v)}
            />
          ) : null}

          {step.id === "review" ? <CheckInSummary draft={draft} /> : null}
        </CardContent>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={stepIdx === 0}
            >
              <ArrowLeft /> Back
            </Button>
            {stepIdx < STEPS.length - 1 ? (
              <Button type="button" onClick={next}>
                Next <ArrowRight />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                <Check /> {isEdit ? "Save changes" : "Submit check-in"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function AutosaveIndicator({
  state,
  isEdit,
}: {
  state: "idle" | "saving" | "saved";
  isEdit: boolean;
}) {
  if (isEdit) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Edits are saved on submit.
      </p>
    );
  }
  if (state === "saving") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving draft…
      </p>
    );
  }
  if (state === "saved") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-success">
        <CloudUpload className="size-3" /> Draft saved
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      Draft autosaves as you type.
    </p>
  );
}

function describe(id: StepId): string {
  switch (id) {
    case "mood":
      return "A quick pulse. Helps your manager spot a tough day early.";
    case "goal":
      return "One clear outcome for today.";
    case "priorities":
      return "Up to five. Drag to reorder, set level and effort.";
    case "tasks":
      return "Pick what you'll touch today.";
    case "blockers":
      return "Surface anything that could slow you down.";
    case "help":
      return "Route a specific ask to a teammate. Optional.";
    case "review":
      return "One last look before you ship the day.";
  }
}

export function getExistingForEdit(): CheckInSubmission | null {
  return getSubmission();
}

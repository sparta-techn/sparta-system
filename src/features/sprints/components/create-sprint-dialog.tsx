import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectsState } from "@/features/projects/store";
import { createSprint } from "../store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}

function toISO(date: string): string {
  return date ? new Date(date).toISOString() : "";
}

function plusDays(d: number): string {
  const date = new Date();
  date.setDate(date.getDate() + d);
  return date.toISOString().slice(0, 10);
}

export function CreateSprintDialog({ open, onOpenChange, defaultProjectId }: Props) {
  const projects = useProjectsState((s) => s.projects);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(plusDays(0));
  const [endDate, setEndDate] = useState(plusDays(14));
  const [capacity, setCapacity] = useState(40);

  const canSubmit = name.trim() && projectId && startDate && endDate && endDate >= startDate;

  function reset() {
    setName("");
    setGoal("");
    setStartDate(plusDays(0));
    setEndDate(plusDays(14));
    setCapacity(40);
  }

  function submit() {
    if (!canSubmit) return;
    const sprint = createSprint({
      name: name.trim(),
      projectId,
      startDate: toISO(startDate),
      endDate: toISO(endDate),
      goal: goal.trim(),
      capacity,
    });
    reset();
    onOpenChange(false);
    navigate({ to: "/app/sprints/$id", params: { id: sprint.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create sprint</DialogTitle>
          <DialogDescription>Group existing tasks into a time-boxed iteration.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 4 · Reporting" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Pick project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Start</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">End</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Goal</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What does success look like for this sprint?"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Capacity (story points)</label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={submit}>Create sprint</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

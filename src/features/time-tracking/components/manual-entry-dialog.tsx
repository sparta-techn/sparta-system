import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTasksState } from "@/features/tasks/store";
import { TIME_TRACKING_CURRENT_USER_ID, addManualEntry } from "../store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When omitted, the dialog asks the user to pick a task. */
  taskId?: string;
}

export function ManualEntryDialog({ open, onOpenChange, taskId }: Props) {
  const tasks = useTasksState((s) => s.tasks);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedTask, setSelectedTask] = useState<string>(taskId ?? "");
  const [date, setDate] = useState<string>(today);
  const [hours, setHours] = useState<string>("1");
  const [description, setDescription] = useState<string>("");

  const targetTaskId = taskId ?? selectedTask;
  const canSubmit = !!targetTaskId && Number(hours) > 0;

  function submit() {
    if (!canSubmit) return;
    addManualEntry({
      taskId: targetTaskId,
      userId: TIME_TRACKING_CURRENT_USER_ID,
      date,
      hours: Number(hours),
      description: description.trim() || undefined,
    });
    setHours("1");
    setDescription("");
    setSelectedTask(taskId ?? "");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
          <DialogDescription>Add a manual time entry. Stored locally for now.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!taskId ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Task</Label>
              <Select value={selectedTask} onValueChange={setSelectedTask}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a task…" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.slice(0, 80).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.ref} · {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="te-date">
                Date
              </Label>
              <Input
                id="te-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="te-hours">
                Hours
              </Label>
              <Input
                id="te-hours"
                type="number"
                min={0.25}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="te-desc">
              Description (optional)
            </Label>
            <Textarea
              id="te-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            Log time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

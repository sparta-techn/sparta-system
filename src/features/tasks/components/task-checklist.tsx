import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { addChecklistItem, removeChecklistItem, toggleChecklistItem } from "../store";
import type { Task } from "../types";
import { checklistProgress } from "../utils";

export function TaskChecklist({ task }: { task: Task }) {
  const [text, setText] = useState("");
  const progress = checklistProgress(task);

  return (
    <div className="space-y-3">
      {progress ? (
        <div className="flex items-center gap-3">
          <Progress value={progress.pct} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">
            {progress.done}/{progress.total} done
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No checklist items yet.</p>
      )}

      <ul className="space-y-1.5">
        {task.checklist.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40"
          >
            <Checkbox
              checked={item.done}
              onCheckedChange={() => toggleChecklistItem(task.id, item.id)}
              aria-label={item.text}
            />
            <span className={item.done ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>
              {item.text}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 opacity-0 group-hover:opacity-100"
              onClick={() => removeChecklistItem(task.id, item.id)}
              aria-label="Remove item"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          addChecklistItem(task.id, text.trim());
          setText("");
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add checklist item…"
          className="h-9"
        />
        <Button size="sm" type="submit" disabled={!text.trim()} className="gap-1">
          <Plus className="size-4" /> Add
        </Button>
      </form>
    </div>
  );
}

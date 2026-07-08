import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { usePlannedTasks } from "../planned-tasks";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

const PRIORITY_TONE = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
} as const;

export function TasksPicker({ selected, onChange }: Props) {
  const tasks = usePlannedTasks();

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No open tasks are assigned to you right now.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Your open assigned tasks. Pick what you intend to work on today.
      </p>
      <ul className="divide-y rounded-lg border bg-card">
        {tasks.map((task) => {
          const checked = selected.includes(task.id);
          return (
            <li key={task.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 p-3 transition hover:bg-accent",
                  checked && "bg-primary-soft/40",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(task.id)}
                  aria-label={`Select ${task.title}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{task.id}</span>
                    <StatusBadge
                      tone={PRIORITY_TONE[task.priority]}
                      label={task.priority}
                      size="sm"
                      withDot={false}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {task.project}
                    {task.deadline ? ` · ${task.deadline}` : ""}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

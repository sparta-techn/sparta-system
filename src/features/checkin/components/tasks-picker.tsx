import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { MOCK_PLANNED_TASKS } from "../mock-data";

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
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id],
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Sourced from ClickUp (mocked). Pick what you intend to work on today.
      </p>
      <ul className="divide-y rounded-lg border bg-card">
        {MOCK_PLANNED_TASKS.map((task) => {
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
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {task.id}
                    </span>
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

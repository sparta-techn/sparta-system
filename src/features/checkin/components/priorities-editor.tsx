import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EFFORT_META,
  type EffortEstimate,
  type PriorityItem,
  type PriorityLevel,
} from "../types";

const MAX = 5;
const LEVELS: PriorityLevel[] = ["low", "medium", "high", "urgent"];
const EFFORTS: EffortEstimate[] = ["xs", "s", "m", "l", "xl"];

interface Props {
  value: PriorityItem[];
  onChange: (next: PriorityItem[]) => void;
}

export function PrioritiesEditor({ value, onChange }: Props) {
  function add() {
    if (value.length >= MAX) return;
    onChange([
      ...value,
      {
        id: `p_${Date.now()}`,
        title: "",
        level: "medium",
        effort: "m",
      },
    ]);
  }
  function update(id: string, patch: Partial<PriorityItem>) {
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function remove(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const idx = value.findIndex((p) => p.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= value.length) return;
    const arr = [...value];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Add up to {MAX} priorities for today.
        </div>
      ) : (
        <ol className="space-y-2">
          {value.map((p, i) => (
            <li
              key={p.id}
              className="grid items-start gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[auto_minmax(0,1fr)_140px_120px_auto]"
            >
              <div className="flex items-center gap-1 pt-1.5 text-muted-foreground">
                <GripVertical className="size-4" aria-hidden />
                <span className="font-display text-sm tabular-nums">{i + 1}</span>
              </div>
              <Input
                value={p.title}
                onChange={(e) => update(p.id, { title: e.target.value })}
                placeholder="Priority…"
                aria-label={`Priority ${i + 1} title`}
              />
              <Select
                value={p.level}
                onValueChange={(v) => update(p.id, { level: v as PriorityLevel })}
              >
                <SelectTrigger aria-label="Priority level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l[0].toUpperCase() + l.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={p.effort}
                onValueChange={(v) => update(p.id, { effort: v as EffortEstimate })}
              >
                <SelectTrigger aria-label="Estimated effort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFORTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {EFFORT_META[e].label} · {EFFORT_META[e].hours}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 justify-self-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Move up"
                  onClick={() => move(p.id, -1)}
                  disabled={i === 0}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Move down"
                  onClick={() => move(p.id, 1)}
                  disabled={i === value.length - 1}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove priority"
                  onClick={() => remove(p.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {value.length} / {MAX} priorities
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={value.length >= MAX}
        >
          <Plus className="size-4" /> Add priority
        </Button>
      </div>
    </div>
  );
}

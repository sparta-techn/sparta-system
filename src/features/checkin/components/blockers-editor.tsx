import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BLOCKER_PRESETS, type BlockerItem } from "../types";

interface Props {
  value: BlockerItem[];
  onChange: (next: BlockerItem[]) => void;
}

export function BlockersEditor({ value, onChange }: Props) {
  function togglePreset(kind: (typeof BLOCKER_PRESETS)[number]["kind"], label: string) {
    const existing = value.find((b) => b.kind === kind);
    if (existing) {
      onChange(value.filter((b) => b.id !== existing.id));
    } else {
      onChange([...value, { id: `b_${kind}_${Date.now()}`, kind, label }]);
    }
  }
  function addCustom() {
    onChange([...value, { id: `b_custom_${Date.now()}`, kind: "custom", label: "" }]);
  }
  function updateCustom(id: string, label: string) {
    onChange(value.map((b) => (b.id === id ? { ...b, label } : b)));
  }
  function updateNote(id: string, note: string) {
    onChange(value.map((b) => (b.id === id ? { ...b, note } : b)));
  }
  function remove(id: string) {
    onChange(value.filter((b) => b.id !== id));
  }

  const customs = value.filter((b) => b.kind === "custom");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {BLOCKER_PRESETS.map((p) => {
          const selected = value.some((b) => b.kind === p.kind);
          return (
            <button
              key={p.kind}
              type="button"
              onClick={() => togglePreset(p.kind, p.label)}
              aria-pressed={selected}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card text-foreground hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {value.filter((b) => b.kind !== "custom").length > 0 ? (
        <div className="space-y-2">
          {value
            .filter((b) => b.kind !== "custom")
            .map((b) => (
              <div key={b.id} className="rounded-lg border bg-card p-3">
                <p className="text-sm font-medium text-foreground">{b.label}</p>
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="Optional context (who, since when, impact)…"
                  value={b.note ?? ""}
                  onChange={(e) => updateNote(b.id, e.target.value)}
                  aria-label={`Note for ${b.label}`}
                />
              </div>
            ))}
        </div>
      ) : null}

      {customs.length > 0 ? (
        <div className="space-y-2">
          {customs.map((b) => (
            <div key={b.id} className="flex items-start gap-2">
              <Input
                value={b.label}
                onChange={(e) => updateCustom(b.id, e.target.value)}
                placeholder="Custom blocker…"
                aria-label="Custom blocker"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove blocker"
                onClick={() => remove(b.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={addCustom}>
        <Plus className="size-4" /> Add custom blocker
      </Button>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { MOOD_OPTIONS, type Mood } from "../types";

interface MoodPickerProps {
  value: Mood | null;
  onChange: (mood: Mood) => void;
}

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Mood"
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {MOOD_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex flex-col items-center justify-center gap-1 rounded-xl border bg-card px-3 py-4 text-center transition",
              "hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary ring-2 ring-primary/30 bg-primary-soft"
                : "border-border",
            )}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {opt.emoji}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                selected ? "text-primary" : "text-foreground",
              )}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

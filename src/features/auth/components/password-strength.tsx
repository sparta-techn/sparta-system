import { passwordStrength } from "../validation";
import { cn } from "@/lib/utils";

const LEVELS = [
  { label: "Very weak", color: "bg-destructive" },
  { label: "Weak", color: "bg-destructive/80" },
  { label: "Okay", color: "bg-warning" },
  { label: "Strong", color: "bg-success/80" },
  { label: "Very strong", color: "bg-success" },
];

export function PasswordStrength({ value }: { value: string }) {
  const score = passwordStrength(value);
  const level = LEVELS[score];
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full bg-muted transition-colors",
              i < score && level.color,
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: <span className="font-medium text-foreground">{level.label}</span> · use 10+
        chars with upper, lower, number, and symbol.
      </p>
    </div>
  );
}

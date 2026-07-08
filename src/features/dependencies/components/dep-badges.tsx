import { cn } from "@/lib/utils";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATE_LABEL,
  STATE_TONE,
  TYPE_LABEL,
  type DependencyPriority,
  type DependencyState,
  type DependencyType,
} from "../types";

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-muted text-foreground/80 ring-border",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/25",
  danger: "bg-destructive-soft text-destructive ring-destructive/25",
  info: "bg-info-soft text-info ring-info/20",
  primary: "bg-primary-soft text-primary ring-primary/20",
};

function Pill({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONE_CLASS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatePill({ state }: { state: DependencyState }) {
  return (
    <Pill tone={STATE_TONE[state]}>
      <span className="status-dot" aria-hidden />
      {STATE_LABEL[state]}
    </Pill>
  );
}

export function PriorityPill({ priority }: { priority: DependencyPriority }) {
  return <Pill tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Pill>;
}

export function TypePill({ type }: { type: DependencyType }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {TYPE_LABEL[type]}
    </span>
  );
}

export function PersonChip({
  name,
  color = "primary",
  sub,
}: {
  name: string;
  color?: string;
  sub?: string;
}) {
  const initials = name
    .split(/[\s.()]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const bg =
    color === "info"
      ? "bg-info-soft text-info"
      : color === "warning"
        ? "bg-warning-soft text-warning"
        : color === "success"
          ? "bg-success-soft text-success"
          : color === "danger"
            ? "bg-destructive-soft text-destructive"
            : "bg-primary-soft text-primary";
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
          bg,
        )}
        aria-hidden
      >
        {initials}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-xs font-medium text-foreground">{name}</span>
        {sub ? (
          <span className="block truncate text-[10px] text-muted-foreground">{sub}</span>
        ) : null}
      </span>
    </span>
  );
}

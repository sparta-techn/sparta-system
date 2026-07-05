import { memo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — canonical badge for any operational status across the app.
 * Always pair color with a label (and optionally a dot) — never color alone.
 */
const badgeStyles = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral:
          "bg-muted text-foreground/80 ring-border",
        success:
          "bg-success-soft text-success ring-success/20 dark:text-success-foreground/90",
        warning:
          "bg-warning-soft text-warning ring-warning/25 dark:text-warning-foreground/90",
        danger:
          "bg-destructive-soft text-destructive ring-destructive/25 dark:text-destructive-foreground/90",
        info:
          "bg-info-soft text-info ring-info/20 dark:text-info-foreground/90",
        primary:
          "bg-primary-soft text-primary ring-primary/20 dark:text-primary-foreground/90",
      },
      size: {
        sm: "h-5 px-2 text-[11px]",
        md: "h-6 px-2.5 text-xs",
        lg: "h-7 px-3 text-sm",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type StatusKind =
  | "working"
  | "offline"
  | "late"
  | "on_break"
  | "remote"
  | "pending"
  | "approved"
  | "rejected"
  | "resolved"
  | "blocked"
  | "completed"
  | "cancelled"
  | "escalated"
  | "acknowledged";

interface StatusMeta {
  label: string;
  tone: NonNullable<VariantProps<typeof badgeStyles>["tone"]>;
}

const STATUS_MAP: Record<StatusKind, StatusMeta> = {
  working: { label: "Working", tone: "success" },
  offline: { label: "Offline", tone: "neutral" },
  late: { label: "Late", tone: "warning" },
  on_break: { label: "On break", tone: "info" },
  remote: { label: "Remote", tone: "primary" },
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  resolved: { label: "Resolved", tone: "success" },
  blocked: { label: "Blocked", tone: "danger" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  escalated: { label: "Escalated", tone: "danger" },
  acknowledged: { label: "Acknowledged", tone: "info" },
};

interface StatusBadgeProps extends VariantProps<typeof badgeStyles> {
  status?: StatusKind;
  label?: string;
  withDot?: boolean;
  className?: string;
}

// Pure, primitive-prop badge rendered many times per list/table row — memoized
// so parent re-renders (selection, filtering) don't re-render every badge.
export const StatusBadge = memo(function StatusBadge({
  status,
  label,
  tone,
  size,
  withDot = true,
  className,
}: StatusBadgeProps) {
  const meta = status ? STATUS_MAP[status] : null;
  const resolvedTone = tone ?? meta?.tone ?? "neutral";
  const resolvedLabel = label ?? meta?.label ?? "Unknown";

  return (
    <span
      className={cn(badgeStyles({ tone: resolvedTone, size }), className)}
      role="status"
      aria-label={resolvedLabel}
    >
      {withDot ? <span className="status-dot" aria-hidden /> : null}
      {resolvedLabel}
    </span>
  );
});

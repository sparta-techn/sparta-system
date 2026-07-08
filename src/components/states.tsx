import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Loader2, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function StateShell({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "muted",
}: StateProps & { tone?: "muted" | "danger" }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "grid size-12 place-items-center rounded-full",
            tone === "danger"
              ? "bg-destructive-soft text-destructive"
              : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
      ) : null}
      <div className="max-w-sm space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateShell icon={props.icon ?? Inbox} {...props} />;
}

export function NoResultsState(props: Partial<Omit<StateProps, "icon">> = {}) {
  return (
    <StateShell
      icon={SearchX}
      title={props.title ?? "No results"}
      description={props.description ?? "Try adjusting your filters or search query."}
      action={props.action}
      className={props.className}
    />
  );
}

export function ErrorState(props: StateProps) {
  return (
    <StateShell
      icon={props.icon ?? AlertTriangle}
      tone="danger"
      title={props.title}
      description={props.description}
      action={props.action}
      className={props.className}
    />
  );
}

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

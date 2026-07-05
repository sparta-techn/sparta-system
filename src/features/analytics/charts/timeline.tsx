import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  intent?: "positive" | "negative" | "neutral" | "warning";
}

const TONE = {
  positive: "bg-success",
  negative: "bg-destructive",
  warning: "bg-warning",
  neutral: "bg-primary",
} as const;

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-4 border-l border-border pl-5", className)}>
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              "absolute -left-[26px] top-1.5 size-3 rounded-full ring-4 ring-background",
              TONE[e.intent ?? "neutral"],
            )}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-medium text-foreground">{e.title}</p>
            <time className="text-xs text-muted-foreground">{e.date}</time>
          </div>
          {e.description ? <p className="text-sm text-muted-foreground">{e.description}</p> : null}
        </li>
      ))}
    </ol>
  );
}

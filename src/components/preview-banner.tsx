import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Markers for features that are not durable yet — their data lives only in the
 * browser (localStorage / mock) and is neither persisted server-side nor shared
 * across users. They keep un-backed modules from looking production-ready. See
 * `docs/MVP_STATUS.md` for which modules are still preview-only.
 */

interface PreviewBannerProps {
  /**
   * Overrides the default explanation. Use to scope the warning to part of a
   * page (e.g. "Some widgets on this page show sample data").
   */
  description?: string;
  className?: string;
}

/** Full-width notice for a route/page that is still a preview. */
export function PreviewBanner({ description, className }: PreviewBannerProps) {
  return (
    <div
      role="note"
      aria-label="Preview feature — data is not saved to the server yet"
      className={cn(
        "mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
          Preview
          <Badge variant="outline" className="border-warning/40 text-warning">
            Not saved yet
          </Badge>
        </p>
        <p className="text-muted-foreground">
          {description ??
            "This is an early preview. Anything you do here is stored only in your browser — it isn't saved to the server or shared with your team yet."}
        </p>
      </div>
    </div>
  );
}

/** Compact inline marker for a preview surface embedded in a larger page. */
export function PreviewBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-warning/40 text-warning", className)}
      title="Preview — stored only in your browser, not saved to the server yet"
    >
      <FlaskConical className="size-3" aria-hidden />
      Preview
    </Badge>
  );
}

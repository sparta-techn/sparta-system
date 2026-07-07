import { Clock } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Markers for features that are planned but out of the current MVP scope. See
 * `src/config/mvp-scope.ts` for the catalogue. Mirrors the `preview-banner.tsx`
 * pattern (PreviewBadge / PreviewBanner) but with "Future Plan" semantics: the
 * feature isn't half-built preview data, it's intentionally deferred.
 */

/** Compact inline marker for a nav item or surface that's deferred. */
export function FuturePlanBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-muted-foreground/30 text-muted-foreground", className)}
      title="Planned for a future release — not part of the current MVP"
    >
      <Clock className="size-3" aria-hidden />
      Future Plan
    </Badge>
  );
}

/** Full-page placeholder shown when a deferred route is opened directly. */
export function FuturePlanPlaceholder({
  title = "Planned feature",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <AppShell>
      <PageHeader eyebrow="Coming soon" title={title} />
      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
        <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Clock className="size-5" aria-hidden />
        </div>
        <p className="flex items-center gap-2 font-medium text-foreground">
          <FuturePlanBadge />
        </p>
        <p className="text-sm text-muted-foreground">
          {description ??
            "This feature is planned for a future release and isn't available in the current version yet."}
        </p>
      </div>
    </AppShell>
  );
}

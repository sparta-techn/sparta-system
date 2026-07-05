/**
 * ErrorScreen — the canonical full-page, user-friendly error surface.
 *
 * Used by the root route's `errorComponent`, the app-level {@link ErrorBoundary}
 * (variant="page"), and the offline screen. It never shows stack traces or raw
 * messages: it derives a friendly line from {@link getErrorMessage} unless the
 * caller passes an explicit title/description.
 */
import { AlertTriangle, RefreshCw, Home, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";

export interface ErrorScreenProps {
  /** The caught error — used to derive a friendly message when title is absent. */
  error?: unknown;
  /** Override the derived heading. */
  title?: string;
  /** Override the derived body copy. */
  description?: string;
  /** Icon shown in the badge. Defaults to a warning triangle. */
  icon?: LucideIcon;
  /** "Try again" handler (e.g. router.invalidate + reset). Hidden if omitted. */
  onRetry?: () => void;
  /** Show a "Go home" link. Defaults to true. */
  showHome?: boolean;
}

export function ErrorScreen({
  error,
  title = "This page didn't load",
  description,
  icon: Icon = AlertTriangle,
  onRetry,
  showHome = true,
}: ErrorScreenProps) {
  const body = description ?? (error ? getErrorMessage(error) : "Something went wrong on our end.");

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div
          className="mx-auto grid size-14 place-items-center rounded-full bg-destructive-soft text-destructive"
          aria-hidden
        >
          <Icon className="size-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button onClick={onRetry}>
              <RefreshCw className="size-4" /> Try again
            </Button>
          ) : null}
          {showHome ? (
            <Button variant={onRetry ? "outline" : "default"} asChild>
              {/* Plain anchor: a full load guarantees a clean slate after a crash. */}
              <a href="/">
                <Home className="size-4" /> Go home
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Dedicated offline screen — reuses ErrorScreen with a connectivity message. */
export function OfflineScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorScreen
      icon={WifiOff}
      title="You're offline"
      description="We can't reach the server. Check your connection — we'll retry automatically."
      onRetry={onRetry}
      showHome={false}
    />
  );
}

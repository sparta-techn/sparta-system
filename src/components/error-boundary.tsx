/**
 * ErrorBoundary — reusable React error boundary for arbitrary subtrees.
 *
 * TanStack Router already gives every route an `errorComponent` (see
 * `routes/__root.tsx`). This complements that for *sub-route* isolation: wrap a
 * dashboard widget, a chart, or a feature panel so a crash there degrades to a
 * fallback instead of taking down the whole page (or route).
 *
 * Behavior:
 *   - Catches render/lifecycle errors in its subtree.
 *   - Reports them once via {@link reportError} (dedup handled downstream).
 *   - Renders a fallback: a custom `fallback` (element or render fn), or the
 *     built-in {@link ErrorFallback} sized by `variant` ("inline" | "page").
 *   - Resets when `resetKeys` change (e.g. the route/id it depends on) or when
 *     the fallback's "Try again" button is pressed.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { ErrorState } from "@/components/states";
import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";
import { getErrorMessage, reportError } from "@/lib/errors";

export interface ErrorFallbackProps {
  error: unknown;
  reset: () => void;
  variant?: "inline" | "page";
}

/** Default fallback UI. "inline" for widgets, "page" for whole-route failures. */
export function ErrorFallback({ error, reset, variant = "inline" }: ErrorFallbackProps) {
  if (variant === "page") {
    return <ErrorScreen error={error} onRetry={reset} />;
  }
  return (
    <ErrorState
      title="This section didn't load"
      description={getErrorMessage(error)}
      action={
        <Button size="sm" variant="outline" onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      }
    />
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback: an element, or a render fn receiving error + reset. */
  fallback?: ReactNode | ((props: { error: unknown; reset: () => void }) => ReactNode);
  /** Size of the built-in fallback when no custom `fallback` is provided. */
  variant?: "inline" | "page";
  /** Changing any value here re-mounts the subtree (auto-recovery on nav). */
  resetKeys?: ReadonlyArray<unknown>;
  /** Extra context attached to the error report (e.g. `{ boundary: "chart" }`). */
  context?: Record<string, unknown>;
  /** Called after a reset so callers can invalidate queries, refetch, etc. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportError(error, {
      boundary: "react_error_boundary",
      componentStack: info.componentStack,
      ...this.props.context,
    });
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    // Auto-recover when the dependencies this subtree was rendered for change.
    if (this.state.error != null && !shallowEqual(prev.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (error == null) return this.props.children;

    const { fallback, variant } = this.props;
    if (typeof fallback === "function") return fallback({ error, reset: this.reset });
    if (fallback !== undefined) return fallback;
    return <ErrorFallback error={error} reset={this.reset} variant={variant} />;
  }
}

function shallowEqual(a?: ReadonlyArray<unknown>, b?: ReadonlyArray<unknown>): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => Object.is(v, b[i]));
}

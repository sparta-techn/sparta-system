/**
 * Small presentational helpers shared by the Integration Center components —
 * relative-time formatting and health/log tone mapping. Kept UI-only (no domain
 * logic) so cards and the detail sheet render consistently.
 */

import type { HealthState } from "../types";
import type { LogLevel } from "../services/mock-telemetry";

/** "just now" / "5m ago" / "2h ago" / "3d ago" from an ISO instant (or "—"). */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  if (diffMs < 45_000) return "just now";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** A tailwind text-color class for a health state (a small status dot). */
export function healthDotClass(state: HealthState): string {
  switch (state) {
    case "healthy":
      return "text-emerald-500";
    case "degraded":
      return "text-amber-500";
    case "down":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

/** Badge variant per log level, reusing the shared Badge variants. */
export function logLevelVariant(level: LogLevel): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "error":
      return "destructive";
    case "warn":
      return "secondary";
    case "info":
      return "outline";
    case "debug":
    default:
      return "outline";
  }
}

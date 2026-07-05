/**
 * Surface → source composition. Declares which context sources feed each AI
 * surface, and wires ready-to-use {@link CompositeContextResolver}s onto a
 * {@link ContextBuilder}.
 *
 * This is the single place that decides "when the assistant is opened from X,
 * gather Y". Adding a surface = one entry here.
 */

import type { ContextBuilder } from "./context-builder";
import type { ContextSourceKey } from "../types";
import { CompositeContextResolver } from "./composite-resolver";
import { getSources } from "./sources";

/** The global surface key used when a request has no explicit surface. */
export const GLOBAL_SURFACE = "global";

/**
 * Which sources each surface composes. `global` is the personal digest used when
 * no surface is given; the rest tailor context to where the assistant opened.
 */
export const SURFACE_SOURCES: Record<string, ContextSourceKey[]> = {
  [GLOBAL_SURFACE]: ["profile", "attendance", "daily_reports", "tasks", "notifications"],
  tasks: ["profile", "tasks", "comments", "dependencies", "sprints"],
  projects: ["profile", "projects", "sprints", "tasks"],
  sprints: ["profile", "sprints", "tasks"],
  analytics: ["profile", "projects", "time_tracking", "attendance"],
  reports: ["profile", "daily_reports", "attendance", "dependencies", "time_tracking"],
  dependencies: ["profile", "dependencies", "tasks"],
};

/** Build a composite resolver for a surface from its declared source list. */
export function buildSurfaceResolver(surface: string): CompositeContextResolver {
  const keys = SURFACE_SOURCES[surface] ?? [];
  return new CompositeContextResolver(surface, getSources(keys));
}

/**
 * Register a resolver for every declared surface onto a builder, and set the
 * `global` resolver as the default (used for the `null` surface).
 */
export function registerDefaultResolvers(builder: ContextBuilder): ContextBuilder {
  for (const surface of Object.keys(SURFACE_SOURCES)) {
    builder.register(buildSurfaceResolver(surface));
  }
  builder.setDefault(buildSurfaceResolver(GLOBAL_SURFACE));
  return builder;
}

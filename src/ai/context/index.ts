/**
 * Barrel for the context layer — the Context Engine.
 *
 * Importing this module configures the shared `contextBuilder` with the default
 * surface resolvers, so `aiEngine` gathers real, service-sourced context out of
 * the box. Sources read only through `@/services/*` — never UI components.
 */

import { contextBuilder } from "./context-builder";
import { registerDefaultResolvers } from "./surfaces";

// Wire the default surface resolvers onto the shared builder (idempotent).
registerDefaultResolvers(contextBuilder);

export { ContextBuilder, contextBuilder, emptyContext } from "./context-builder";
export { CompositeContextResolver, mergeFragments } from "./composite-resolver";
export {
  GLOBAL_SURFACE,
  SURFACE_SOURCES,
  buildSurfaceResolver,
  registerDefaultResolvers,
} from "./surfaces";
export {
  CONTEXT_SOURCES,
  getSource,
  getSources,
  profileSource,
  attendanceSource,
  dailyReportsSource,
  projectsSource,
  tasksSource,
  sprintsSource,
  timeTrackingSource,
  commentsSource,
  dependenciesSource,
  notificationsSource,
} from "./sources";

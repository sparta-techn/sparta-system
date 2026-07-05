/**
 * Realtime feature barrel.
 *
 * Per-domain subscription hooks (auto-unsubscribe on unmount, RLS-scoped
 * channels). The generic primitive lives in `@/hooks/use-realtime`; the
 * transport/manager in `@/lib/supabase/realtime`.
 */
export {
  useNotificationsRealtime,
  useTaskRealtime,
  useTaskAssignmentRealtime,
  useCommentsRealtime,
  useMentionsRealtime,
  useDailyReportsRealtime,
  useAttendanceRealtime,
  useDependencyRealtime,
  type DomainHandlers,
} from "./hooks";

export { useRealtimeSubscription, type RealtimeStatus } from "@/hooks/use-realtime";
export { realtimeManager, isRealtimeEnabled, PUBLISHED_TABLES } from "@/lib/supabase/realtime";

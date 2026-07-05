import type {
  AnalyticsFilters,
  AnalyticsScope,
  BenchmarkValue,
  Insight,
  SavedReport,
  TrendPoint,
} from "@/features/analytics/types";
import { BaseService } from "../core/base-service";
import { toServiceError } from "../core/errors";
import type { ListParams } from "../core/types";

export type SavedReportInsert = Omit<SavedReport, "id" | "createdAt">;
export type SavedReportUpdate = Partial<SavedReportInsert>;

/**
 * AnalyticsService — read-mostly metrics plus CRUD for saved reports.
 *
 * Aggregate reads are served by Supabase RPCs / views (`analytics_metric`,
 * `analytics_trend`, `analytics_insights`), so the heavy aggregation stays in
 * the database. CRUD (inherited) targets the `saved_reports` table.
 */
export class AnalyticsService extends BaseService<
  SavedReport,
  SavedReportInsert,
  SavedReportUpdate
> {
  protected readonly table = "saved_reports";
  protected readonly entity = "Saved report";

  // ── Saved reports ────────────────────────────────────────────────────────

  /** Saved reports for a scope (personal / team / hr / executive). */
  listByScope(scope: AnalyticsScope, params: ListParams<SavedReport> = {}): Promise<SavedReport[]> {
    return this.list({ ...params, filters: { ...params.filters, scope } });
  }

  /** Pin or unpin a saved report. */
  setPinned(id: string, pinned: boolean): Promise<SavedReport> {
    return this.update(id, { pinned } as SavedReportUpdate);
  }

  // ── Aggregate reads (RPC-backed) ─────────────────────────────────────────

  /** A single benchmarked metric (current vs. previous period). */
  async getMetric(metric: string, filters: AnalyticsFilters): Promise<BenchmarkValue> {
    return this.callRpc<BenchmarkValue>("analytics_metric", { metric, filters });
  }

  /** A labelled trend series for charting. */
  async getTrend(metric: string, filters: AnalyticsFilters): Promise<TrendPoint[]> {
    return this.callRpc<TrendPoint[]>("analytics_trend", { metric, filters });
  }

  /** Generated insights for a scope + filter set. */
  async getInsights(scope: AnalyticsScope, filters: AnalyticsFilters): Promise<Insight[]> {
    return this.callRpc<Insight[]>("analytics_insights", { scope, filters });
  }

  /** Thin wrapper that normalizes RPC errors to {@link ServiceError}. */
  private async callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    try {
      const { data, error } = await this.client.rpc(fn, args as never);
      if (error) throw error;
      return data as unknown as T;
    } catch (error) {
      throw toServiceError(error, `Failed to compute ${fn}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const analyticsService = new AnalyticsService();

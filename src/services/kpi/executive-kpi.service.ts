import type { AnalyticsFilters } from "@/features/analytics/types";
import { db } from "../core/client";
import { toServiceError } from "../core/errors";
import {
  computeCompanyKpis,
  computeEngineeringKpis,
  computeProjectKpis,
  computeReportKpis,
} from "./kpi-calculators";
import type {
  CompanyKpiInput,
  CompanyKpis,
  EngineeringKpiInput,
  EngineeringKpis,
  ExecutiveKpiInput,
  ExecutiveKpis,
  ProjectKpiInput,
  ProjectKpis,
  ReportKpiInput,
  ReportKpis,
} from "./kpi-types";

/**
 * ExecutiveKpiService — the single boundary for executive KPI calculation.
 *
 * It exposes each KPI group two ways:
 *
 * - **`compute*(input)`** — synchronous, pure, offline. Delegates to the
 *   {@link ./kpi-calculators calculators} over an in-memory snapshot. Works
 *   today against the mock stores, and is fully unit-testable. Use this from a
 *   hook that already holds the domain data, or in tests.
 *
 * - **`get*(filters)`** — asynchronous, RPC-backed. The target production path:
 *   heavy aggregation runs in Supabase (`kpi_company`, `kpi_projects`,
 *   `kpi_engineering`, `kpi_reports` — views/`SECURITY DEFINER` RPCs), keeping
 *   the wire payload to just the computed KPIs. Mirrors the existing
 *   `AnalyticsService` RPC pattern. These RPCs land with the analytics-views
 *   migration; until then, prefer the `compute*` path fed by an adapter.
 *
 * No component calls this directly — it is consumed inside hooks / TanStack
 * Query functions, per CLAUDE.md's "components never call APIs directly".
 */
export class ExecutiveKpiService {
  // ── Pure, snapshot-based computation (available now) ──────────────────────

  computeCompany(input: CompanyKpiInput): CompanyKpis {
    return computeCompanyKpis(input);
  }

  computeProjects(input: ProjectKpiInput): ProjectKpis {
    return computeProjectKpis(input);
  }

  computeEngineering(input: EngineeringKpiInput): EngineeringKpis {
    return computeEngineeringKpis(input);
  }

  computeReports(input: ReportKpiInput): ReportKpis {
    return computeReportKpis(input);
  }

  /** Compute all four KPI groups from a single assembled snapshot. */
  computeAll(input: ExecutiveKpiInput): ExecutiveKpis {
    return {
      company: this.computeCompany(input.company),
      projects: this.computeProjects(input.projects),
      engineering: this.computeEngineering(input.engineering),
      reports: this.computeReports(input.reports),
    };
  }

  // ── Server-backed reads (target production path) ──────────────────────────

  getCompany(filters: AnalyticsFilters): Promise<CompanyKpis> {
    return this.rpc<CompanyKpis>("kpi_company", filters);
  }

  getProjects(filters: AnalyticsFilters): Promise<ProjectKpis> {
    return this.rpc<ProjectKpis>("kpi_projects", filters);
  }

  getEngineering(filters: AnalyticsFilters): Promise<EngineeringKpis> {
    return this.rpc<EngineeringKpis>("kpi_engineering", filters);
  }

  getReports(filters: AnalyticsFilters): Promise<ReportKpis> {
    return this.rpc<ReportKpis>("kpi_reports", filters);
  }

  /** Fetch all four KPI groups in parallel. */
  async getAll(filters: AnalyticsFilters): Promise<ExecutiveKpis> {
    const [company, projects, engineering, reports] = await Promise.all([
      this.getCompany(filters),
      this.getProjects(filters),
      this.getEngineering(filters),
      this.getReports(filters),
    ]);
    return { company, projects, engineering, reports };
  }

  /** Thin wrapper that normalizes RPC errors to a {@link ServiceError}. */
  private async rpc<T>(fn: string, filters: AnalyticsFilters): Promise<T> {
    try {
      const { data, error } = await db.rpc(fn, { filters } as never);
      if (error) throw error;
      return data as unknown as T;
    } catch (error) {
      throw toServiceError(error, `Failed to compute ${fn}`);
    }
  }
}

/** Shared singleton — import this, not the class. */
export const executiveKpiService = new ExecutiveKpiService();

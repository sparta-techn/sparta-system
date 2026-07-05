/**
 * Executive KPI services.
 *
 * `executiveKpiService` is the boundary; the pure calculators are re-exported
 * for direct use in hooks and tests. See `docs/KPI_SERVICES.md`.
 */
export { ExecutiveKpiService, executiveKpiService } from "./executive-kpi.service";
export * from "./kpi-calculators";
export type * from "./kpi-types";

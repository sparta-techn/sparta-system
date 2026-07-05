/**
 * Organization Health service.
 *
 * `computeOrganizationHealth(input)` produces the seven health metrics
 * (Engineering, HR, Project, Attendance, Collaboration, AI Confidence, Overall).
 * See `docs/ORGANIZATION_HEALTH.md`.
 */
export * from "./health-calculators";
export type * from "./health-types";
export { BAND_LABEL, BAND_RANK, DEFAULT_BANDS, DEFAULT_OVERALL_WEIGHTS } from "./health-types";

/**
 * Default seed data planted by the one-time bootstrap.
 *
 * The role → permission model is **not** redefined here — it is re-exported
 * from `features/auth/permissions.ts` (the single source of truth) so bootstrap,
 * the UI, and the SQL seed can never drift. Every list is applied idempotently
 * (upsert on the natural key), so re-running bootstrap never duplicates rows.
 */
import { PERMISSION_CATALOG, ROLE_PERMISSIONS } from "@/features/auth/permissions";
import type { AppRole } from "@/features/auth/types";

/** Fallbacks used when the operator does not override them via env / input. */
export const DEFAULT_COMPANY_NAME = "SpartaFlow";
export const DEFAULT_WORKSPACE_NAME = "General";
export const DEFAULT_TIMEZONE = "Africa/Cairo";

/** Default departments for a remote software company. */
export const DEFAULT_DEPARTMENTS: ReadonlyArray<{
  name: string;
  slug: string;
  description: string;
}> = [
  { name: "Engineering", slug: "engineering", description: "Software design, build and delivery" },
  { name: "Product", slug: "product", description: "Product management and strategy" },
  { name: "Design", slug: "design", description: "Product and brand design" },
  { name: "Operations", slug: "operations", description: "Company operations and IT" },
  { name: "People", slug: "people", description: "People, HR and talent" },
  { name: "Marketing", slug: "marketing", description: "Growth, brand and communications" },
  { name: "Sales", slug: "sales", description: "Revenue and account management" },
  { name: "Finance", slug: "finance", description: "Finance, accounting and payroll" },
];

/**
 * Default permission catalog — the granular enterprise RBAC keys. Sourced from
 * `features/auth/permissions.ts`; the bootstrap ensures these rows exist in the
 * `permissions` table even if the DB was reset.
 */
export const DEFAULT_PERMISSIONS = PERMISSION_CATALOG;

/** Default role → permission matrix. Mirror of `permissions.ts`. */
export const DEFAULT_ROLE_PERMISSIONS = ROLE_PERMISSIONS;

/** All application roles the matrix covers (the `app_role` enum). */
export const DEFAULT_ROLES = Object.keys(ROLE_PERMISSIONS) as readonly AppRole[];

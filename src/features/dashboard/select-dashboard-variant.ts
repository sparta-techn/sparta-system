import type { AppRole } from "@/features/auth/types";

export type DashboardVariant = "executive" | "manager" | "personal";

/**
 * Picks the landing dashboard for a user from their (possibly multiple) roles.
 * Roles are additive, so we check highest-privilege first and fall through:
 *
 *  - Owner / Admin           → executive (company-wide cockpit)
 *  - HR / Project Manager     → manager (operational team view)
 *  - everyone else            → personal (check-in focused)
 *
 * `team_lead` deliberately lands on the **personal** dashboard: a team lead is
 * an individual contributor with review powers, not a manager, so they should
 * not open the Manager dashboard by default. Their review surfaces (Report
 * reviews, etc.) are still reachable from the nav.
 */
export function selectDashboardVariant(roles: AppRole[]): DashboardVariant {
  if (roles.includes("owner") || roles.includes("admin")) return "executive";
  if (roles.includes("hr") || roles.includes("project_manager")) return "manager";
  return "personal";
}

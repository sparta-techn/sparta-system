import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmployeeDirectory } from "@/features/hr/components/employee-directory";
import { InvitationsManager } from "@/features/hr/components/invitations-manager";
import { AuditLogView } from "@/features/audit/components/audit-log-view";
import { AdminOverview } from "./admin-overview";
import { RolesPanel } from "./roles-panel";
import { PermissionsPanel } from "./permissions-panel";
import { DepartmentsPanel } from "./departments-panel";
import { TeamsPanel } from "./teams-panel";
import { SystemSettingsPanel } from "./system-settings-panel";
import { FeatureFlagsPanel } from "./feature-flags-panel";
import { MaintenancePanel } from "./maintenance-panel";

type SectionId =
  | "overview"
  | "users"
  | "roles"
  | "permissions"
  | "departments"
  | "teams"
  | "invitations"
  | "audit"
  | "settings"
  | "flags"
  | "maintenance";

const SECTIONS: { id: SectionId; label: string; render: () => React.ReactNode }[] = [
  { id: "overview", label: "Overview", render: () => <AdminOverview /> },
  { id: "users", label: "Users", render: () => <EmployeeDirectory /> },
  { id: "roles", label: "Roles", render: () => <RolesPanel /> },
  { id: "permissions", label: "Permissions", render: () => <PermissionsPanel /> },
  { id: "departments", label: "Departments", render: () => <DepartmentsPanel /> },
  { id: "teams", label: "Teams", render: () => <TeamsPanel /> },
  { id: "invitations", label: "Invitations", render: () => <InvitationsManager /> },
  { id: "audit", label: "Audit logs", render: () => <AuditLogView /> },
  { id: "settings", label: "System settings", render: () => <SystemSettingsPanel /> },
  { id: "flags", label: "Feature flags", render: () => <FeatureFlagsPanel /> },
  { id: "maintenance", label: "Maintenance", render: () => <MaintenancePanel /> },
];

/**
 * Owner-only Admin Console. Composes existing feature surfaces (Users,
 * Invitations, Audit) with admin-specific panels (Roles, Permissions,
 * Departments, Teams, System settings, Feature flags, Maintenance) behind a
 * single section switcher styled like the HR/Analytics subnav.
 */
export function AdminConsole() {
  const [active, setActive] = useState<SectionId>("overview");
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div>
      <nav className="mb-4 -mx-1 flex gap-1 overflow-x-auto border-b" aria-label="Admin sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            aria-current={s.id === active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              s.id === active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>
      {section.render()}
    </div>
  );
}

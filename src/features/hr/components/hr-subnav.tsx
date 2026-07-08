import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Overview", to: "/app/hr" },
  { label: "Employees", to: "/app/hr/employees" },
  { label: "Invitations", to: "/app/hr/invitations" },
  { label: "Leave", to: "/app/hr/leave" },
  { label: "Organization", to: "/app/hr/organization" },
  { label: "Onboarding", to: "/app/hr/onboarding" },
  { label: "Offboarding", to: "/app/hr/offboarding" },
  { label: "Documents", to: "/app/hr/documents" },
  { label: "Announcements", to: "/app/hr/announcements" },
  { label: "Audit", to: "/app/hr/audit" },
] as const;

export function HrSubnav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="mb-4 -mx-1 flex gap-1 overflow-x-auto border-b" aria-label="HR sections">
      {NAV.map((item) => {
        const isActive =
          item.to === "/app/hr"
            ? pathname === "/app/hr"
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

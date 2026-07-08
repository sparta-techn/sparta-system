import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ExportMenu } from "./export-menu";

const NAV: { label: string; to: string; exact?: boolean; scope: string }[] = [
  { label: "Me", to: "/app/analytics", exact: true, scope: "personal" },
  { label: "Team", to: "/app/analytics/team", scope: "team" },
  { label: "HR", to: "/app/analytics/hr", scope: "hr" },
  { label: "Executive", to: "/app/analytics/executive", scope: "executive" },
  { label: "Saved reports", to: "/app/analytics/saved", scope: "saved" },
];

export function AnalyticsSubnav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active =
    NAV.find((n) =>
      n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(`${n.to}/`),
    ) ?? NAV[0];
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b">
      <nav className="-mx-1 flex gap-1 overflow-x-auto" aria-label="Analytics sections">
        {NAV.map((item) => {
          const isActive = item === active;
          return (
            <Link
              key={item.to}
              to={item.to as never}
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
      <div className="pb-2">
        <ExportMenu scope={active.scope} />
      </div>
    </div>
  );
}

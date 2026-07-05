import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Overview", to: "/app/projects" },
  { label: "All projects", to: "/app/projects/all" },
  { label: "Clients", to: "/app/projects/clients" },
  { label: "Templates", to: "/app/projects/templates" },
  { label: "Workspace", to: "/app/projects/workspace" },
] as const;

export function ProjectsSubnav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="mb-4 -mx-1 flex gap-1 overflow-x-auto border-b" aria-label="Projects sections">
      {NAV.map((item) => {
        const isActive =
          item.to === "/app/projects"
            ? pathname === "/app/projects"
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

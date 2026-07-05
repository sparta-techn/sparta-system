import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Reusable section wrapper — consistent heading, spacing, and `aria-label` for
 * every executive dashboard section. Keeps the composition file declarative.
 */
export function DashboardSection({
  id,
  title,
  description,
  actions,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section aria-label={title} id={id} className={cn("scroll-mt-20", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

import { memo } from "react";
import { cn } from "@/lib/utils";
import { employeeById, initials } from "../utils";

// Rendered on every task row/card — memoized on its primitive props.
export const EmployeeChip = memo(function EmployeeChip({
  id,
  size = "sm",
  showName = true,
  className,
}: {
  id: string | null | undefined;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  className?: string;
}) {
  const emp = employeeById(id ?? undefined);
  const dim = size === "xs" ? "size-5 text-[10px]" : size === "md" ? "size-7 text-xs" : "size-6 text-[11px]";

  if (!emp) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
        <span className={cn("grid place-items-center rounded-full bg-muted text-muted-foreground", dim)} aria-hidden>
          ?
        </span>
        {showName ? <span className="text-xs">Unassigned</span> : null}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("grid place-items-center rounded-full font-medium text-white", dim)}
        style={{ background: `hsl(${emp.avatarHue} 70% 45%)` }}
        aria-hidden
      >
        {initials(emp.name)}
      </span>
      {showName ? <span className="truncate text-xs">{emp.name}</span> : null}
    </span>
  );
});

import { cn } from "@/lib/utils";
import type { HrEmployee } from "../mock-data";

export function EmployeeAvatar({
  employee,
  size = 36,
  className,
}: {
  employee: Pick<HrEmployee, "initials" | "avatarHue" | "name">;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-grid place-items-center rounded-full font-medium text-white shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${employee.avatarHue} 70% 45%), hsl(${(employee.avatarHue + 40) % 360} 70% 35%))`,
      }}
      aria-label={employee.name}
      title={employee.name}
    >
      {employee.initials}
    </div>
  );
}

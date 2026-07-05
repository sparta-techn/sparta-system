import type { CompanyKpis } from "@/services/kpi";
import { KpiCard } from "./kpi-card";
import { DashboardSection } from "./dashboard-section";

/** Company KPIs — headcount, presence, attendance, productivity (HR + Attendance). */
export function CompanySection({ kpis }: { kpis: CompanyKpis }) {
  const cards = [
    kpis.activeEmployees,
    kpis.employeesOnline,
    kpis.employeesOnLeave,
    kpis.attendanceRate,
    kpis.productivityScore,
  ];
  return (
    <DashboardSection
      id="company"
      title="Company KPIs"
      description="Live workforce signals across HR and attendance."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>
    </DashboardSection>
  );
}

import { StatCard } from "@/components/stat-card";
import { LineChart } from "@/features/analytics/charts";
import { ChartCard } from "@/features/analytics/components/chart-card";
import type { AttendancePulse } from "../types";
import { DashboardSection } from "./dashboard-section";

/** Attendance — today's presence split and the weekly on-time trend. */
export function AttendanceSection({ pulse }: { pulse: AttendancePulse }) {
  return (
    <DashboardSection
      id="attendance"
      title="Attendance"
      description="Who's in today and how punctuality is trending."
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 xl:col-span-1">
          <StatCard label="Present" value={pulse.present} />
          <StatCard label="Late" value={pulse.late} />
          <StatCard label="Absent" value={pulse.absent} />
          <StatCard label="On leave" value={pulse.onLeave} />
        </div>

        <ChartCard
          title="On-time attendance"
          description="Weekly compliance %"
          className="xl:col-span-2"
        >
          <LineChart
            data={pulse.trend}
            colorClass="stroke-success"
            formatValue={(n) => `${n}%`}
            ariaLabel="On-time attendance trend"
          />
        </ChartCard>
      </div>
    </DashboardSection>
  );
}

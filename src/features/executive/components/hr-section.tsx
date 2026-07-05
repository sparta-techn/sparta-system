import { CakeSlice, UserMinus, UserPlus, Users } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/features/analytics/charts";
import type { HrPulse } from "../types";
import { DashboardSection } from "./dashboard-section";

/** HR — headcount movement and the department split. */
export function HrSection({ pulse }: { pulse: HrPulse }) {
  const donut = pulse.byDepartment.map((d) => ({ label: d.name, value: d.headcount }));

  return (
    <DashboardSection
      id="hr"
      title="HR"
      description="Headcount, hiring pipeline, and organisation shape."
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 xl:col-span-2">
          <StatCard
            label="Total headcount"
            value={pulse.totalHeadcount}
            icon={Users}
            hint={`${pulse.activeHeadcount} active`}
          />
          <StatCard
            label="New hires (30d)"
            value={pulse.newHires30d}
            icon={UserPlus}
            trend={{ direction: "up", value: "+4", intent: "positive" }}
          />
          <StatCard label="Offboarding" value={pulse.offboarding} icon={UserMinus} />
          <StatCard label="Birthdays this week" value={pulse.birthdaysThisWeek} icon={CakeSlice} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Headcount by department</CardTitle>
            <CardDescription>Where the team sits today.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={donut}
              centerLabel="People"
              centerValue={String(pulse.totalHeadcount)}
              ariaLabel="Headcount by department"
            />
          </CardContent>
        </Card>
      </div>
    </DashboardSection>
  );
}

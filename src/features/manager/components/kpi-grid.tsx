import {
  Activity,
  AlertTriangle,
  CalendarX,
  ClipboardCheck,
  Coffee,
  GaugeCircle,
  Sun,
  Timer,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { managerKpis } from "../mock-data";

export function KpiGrid() {
  const k = managerKpis;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label="Working"
        value={k.working}
        icon={Activity}
        trend={{ direction: "up", value: "+2", intent: "positive" }}
      />
      <StatCard label="On break" value={k.onBreak} icon={Coffee} />
      <StatCard
        label="Late"
        value={k.late}
        icon={Timer}
        trend={{ direction: "flat", value: "0" }}
        hint="vs yesterday"
      />
      <StatCard
        label="Absent"
        value={k.absent}
        icon={CalendarX}
        trend={{ direction: "up", value: "+1", intent: "negative" }}
      />
      <StatCard label="Critical" value={k.critical} icon={AlertTriangle} hint="needs action" />
      <StatCard label="Pending check-ins" value={k.pendingCheckins} icon={Sun} />
      <StatCard label="Pending midday" value={k.pendingMidday} icon={GaugeCircle} />
      <StatCard label="Pending EOD" value={k.pendingEod} icon={ClipboardCheck} />
    </div>
  );
}

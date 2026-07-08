import { Activity, BarChart3, GaugeCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Sprint } from "../types";
import { BurndownMock } from "./burndown-mock";

function Placeholder({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  );
}

export function SprintReports({ sprint }: { sprint: Sprint }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Placeholder
          icon={GaugeCircle}
          label="Sprint velocity"
          value="—"
          hint="Average story points completed per sprint. Available after real analytics ship."
        />
        <Placeholder
          icon={Activity}
          label="Completion rate"
          value="—"
          hint="Committed vs. delivered ratio across recent sprints."
        />
        <Placeholder
          icon={BarChart3}
          label="Scope change"
          value="—"
          hint="Tasks added or removed mid-sprint. Tracked once events are recorded."
        />
      </div>

      <BurndownMock sprint={sprint} />

      <Card className="p-5 text-xs text-muted-foreground">
        Reports are intentionally placeholders. Real analytics will flow from the Analytics module
        once sprint events (start, scope change, completion) are emitted to the event bus.
      </Card>
    </div>
  );
}

import { AlertTriangle, ArrowRight, GaugeCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { mockMidday } from "../mock-data";

export function MiddayStatusCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <GaugeCircle className="size-4 text-info" aria-hidden /> Midday status
          </CardTitle>
          <CardDescription>Due by 14:00 · keep your team in sync.</CardDescription>
        </div>
        <StatusBadge
          tone={mockMidday.submitted ? "success" : "warning"}
          label={mockMidday.submitted ? "Submitted" : "Pending"}
        />
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="tabular-nums">{mockMidday.progress}%</span>
          </div>
          <Progress value={mockMidday.progress} className="h-2" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Blockers
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {mockMidday.blockers.map((b) => (
              <li key={b} className="flex items-start gap-2 text-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Since morning
          </p>
          <p className="mt-1 text-foreground">{mockMidday.changedSinceMorning}</p>
        </div>
        <Button className="w-full" variant="outline">
          Submit update <ArrowRight />
        </Button>
      </CardContent>
    </Card>
  );
}

import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { mockCheckIn } from "../mock-data";

export function CheckInCard() {
  const submitted = mockCheckIn.submitted;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden /> Morning check-in
          </CardTitle>
          <CardDescription>
            Set your intent for the day in under 30 seconds.
          </CardDescription>
        </div>
        <StatusBadge
          tone={submitted ? "success" : "warning"}
          label={submitted ? "Submitted" : "Not submitted"}
        />
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Row label="Mood" value={<span className="text-xl leading-none">{mockCheckIn.mood}</span>} />
        <Row label="Focus" value={<span className="text-foreground">{mockCheckIn.focus}</span>} />
        <Row
          label="Blockers"
          value={<span className="text-muted-foreground">{mockCheckIn.blockers}</span>}
        />
        <Button className="w-full" disabled={submitted}>
          {submitted ? "Update check-in" : "Fill check-in"} <ArrowRight />
        </Button>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{value}</div>
    </div>
  );
}

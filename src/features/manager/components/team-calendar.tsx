import { Cake, CalendarDays, PartyPopper, Plane, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { managerCalendar, type CalendarItem } from "../mock-data";

const ICONS: Record<CalendarItem["kind"], LucideIcon> = {
  leave: Plane, holiday: PartyPopper, birthday: Cake, meeting: Users,
};
const TONES: Record<CalendarItem["kind"], string> = {
  leave: "bg-info-soft text-info",
  holiday: "bg-primary-soft text-primary",
  birthday: "bg-warning-soft text-warning",
  meeting: "bg-muted text-foreground",
};

export function TeamCalendar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="size-4" aria-hidden /> Team calendar
        </CardTitle>
        <CardDescription>Leaves, holidays, birthdays, and meetings.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {managerCalendar.map((c) => {
            const Icon = ICONS[c.kind];
            const d = new Date(c.date);
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                <div className="grid size-10 place-items-center rounded-lg bg-surface/40 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.toLocaleString("en", { month: "short" })}</p>
                  <p className="-mt-0.5 text-sm font-semibold tabular-nums">{d.getDate()}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                  {c.who ? <p className="truncate text-xs text-muted-foreground">{c.who}</p> : null}
                </div>
                <span className={`grid size-7 shrink-0 place-items-center rounded-md ${TONES[c.kind]}`} aria-hidden>
                  <Icon className="size-3.5" />
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

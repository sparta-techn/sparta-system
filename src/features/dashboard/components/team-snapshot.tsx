import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { mockTeam, type MockTeammate } from "../mock-data";

const DOT: Record<MockTeammate["status"], string> = {
  working: "bg-success",
  on_break: "bg-info",
  late: "bg-warning",
  offline: "bg-muted-foreground/40",
};

const LABEL: Record<MockTeammate["status"], string> = {
  working: "Working",
  on_break: "On break",
  late: "Late",
  offline: "Offline",
};

export function TeamSnapshot() {
  const counts = mockTeam.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<MockTeammate["status"], number>,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team snapshot</CardTitle>
        <CardDescription>Who's around right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(["working", "on_break", "late", "offline"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", DOT[s])} aria-hidden />
              <span className="tabular-nums text-foreground">{counts[s] ?? 0}</span> {LABEL[s]}
            </span>
          ))}
        </div>
        <TooltipProvider delayDuration={150}>
          <ul className="flex flex-wrap gap-2">
            {mockTeam.map((t) => (
              <li key={t.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${t.name} — ${LABEL[t.status]}`}
                      className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-muted text-xs font-semibold">
                          {t.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card",
                          DOT[t.status],
                        )}
                        aria-hidden
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.role} · {LABEL[t.status]}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

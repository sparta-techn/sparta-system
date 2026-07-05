import { AlertTriangle, CheckCircle2, ClipboardCheck, Sparkles, Users } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { MOCK_TEAM_EOD } from "../mock-data";

interface Props {
  /** HR view: hide qualitative work info, show only participation. */
  hrMode?: boolean;
}

export function ManagerEodOverview({ hrMode = false }: Props) {
  const team = MOCK_TEAM_EOD;
  const submitted = team.filter((t) => t.submitted);
  const missing = team.filter((t) => !t.submitted);
  const submissionRate = Math.round((submitted.length / team.length) * 100);

  const avgCompletion =
    submitted.length === 0
      ? 0
      : Math.round(
          submitted.reduce((a, t) => a + (t.completionPct ?? 0), 0) / submitted.length,
        );

  const totalDone = submitted.reduce((a, t) => a + (t.completedCount ?? 0), 0);
  const totalOpenDeps = submitted.reduce((a, t) => a + (t.openDepsCount ?? 0), 0);
  const tomorrowRisks = submitted.filter((t) => !!t.tomorrowRisk);

  const commonBlockers = aggregate(submitted.map((t) => t.topBlocker).filter(Boolean) as string[]);
  const helpRequests = submitted.filter((t) => !!t.helpRequest);

  return (
    <div className="space-y-6">
      <section aria-label="EOD KPIs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Submission rate"
          value={`${submissionRate}%`}
          hint={`${submitted.length} of ${team.length} reported`}
        />
        <StatCard
          label="Avg. completion"
          value={hrMode ? "—" : `${avgCompletion}%`}
          hint={hrMode ? "Hidden in HR view" : "Across submitted reports"}
        />
        <StatCard
          label="Work shipped"
          value={hrMode ? "—" : String(totalDone)}
          hint={hrMode ? "Hidden in HR view" : "Tasks completed today"}
        />
        <StatCard
          label="Open dependencies"
          value={hrMode ? "—" : String(totalOpenDeps)}
          hint={hrMode ? "Hidden in HR view" : "Pinned in today's reports"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" aria-hidden /> Missing reports
            </CardTitle>
            <CardDescription>People who haven't submitted EOD yet.</CardDescription>
          </CardHeader>
          <CardContent>
            {missing.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone has reported.</p>
            ) : (
              <ul className="space-y-2">
                {missing.map((t) => (
                  <li
                    key={t.employeeId}
                    className="flex items-center justify-between gap-3 rounded-md border bg-card p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold" aria-hidden>
                        {t.initials}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.department} · {t.role}
                        </p>
                      </div>
                    </div>
                    <StatusBadge label="Pending" size="sm" tone="warning" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {hrMode ? null : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="size-4 text-success" aria-hidden /> Most completed work
              </CardTitle>
              <CardDescription>Top contributors by tasks shipped today.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {[...submitted]
                  .sort((a, b) => (b.completedCount ?? 0) - (a.completedCount ?? 0))
                  .slice(0, 5)
                  .map((t) => (
                    <li
                      key={t.employeeId}
                      className="flex items-center justify-between gap-3 rounded-md border bg-card p-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-hidden>
                          {t.initials}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                        <span className="text-sm font-medium tabular-nums">{t.completedCount ?? 0}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {hrMode ? null : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-warning" aria-hidden /> Common blockers
              </CardTitle>
              <CardDescription>Themes across today's reports.</CardDescription>
            </CardHeader>
            <CardContent>
              {commonBlockers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blockers reported.</p>
              ) : (
                <ul className="space-y-1.5">
                  {commonBlockers.map((b) => (
                    <li
                      key={b.label}
                      className="flex items-center justify-between gap-3 rounded-md border bg-card p-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">{b.label}</span>
                      <StatusBadge label={`${b.count}×`} size="sm" withDot={false} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-info" aria-hidden /> Tomorrow risks
              </CardTitle>
              <CardDescription>What people flagged for the next day.</CardDescription>
            </CardHeader>
            <CardContent>
              {tomorrowRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tomorrow risks flagged.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tomorrowRisks.map((t) => (
                    <li
                      key={t.employeeId}
                      className="flex items-start gap-3 rounded-md border bg-card p-2.5 text-sm"
                    >
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold" aria-hidden>
                        {t.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground">{t.tomorrowRisk}</p>
                        <p className="text-xs text-muted-foreground">{t.name} · {t.department}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {hrMode ? null : helpRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open help requests</CardTitle>
            <CardDescription>Specific asks routed to other teams.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {helpRequests.map((t) => (
                <li
                  key={t.employeeId}
                  className="flex items-start gap-3 rounded-md border bg-card p-2.5 text-sm"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-info-soft text-[11px] font-semibold text-info" aria-hidden>
                    {t.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{t.helpRequest}</p>
                    <p className="text-xs text-muted-foreground">{t.name} · {t.department}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {hrMode ? null : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completion by person</CardTitle>
            <CardDescription>Where each report sits.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {submitted.map((t) => (
                <li key={t.employeeId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t.completionPct ?? 0}%
                    </span>
                  </div>
                  <Progress value={t.completionPct ?? 0} className="h-1.5" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function aggregate(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

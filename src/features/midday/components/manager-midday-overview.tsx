import { AlertTriangle, GaugeCircle, Users } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { useTeamMiddayOverview } from "../hooks";
import { OUTLOOK_META, type EndOfDayOutlook, type TeamMiddayEntry } from "../types";

interface Props {
  /** When true, hide all qualitative work info and only show participation metrics (HR view). */
  hrMode?: boolean;
}

export function ManagerMiddayOverview({ hrMode = false }: Props) {
  const { entries: team, loading, error } = useTeamMiddayOverview();
  const submitted = team.filter((t) => t.submitted);
  const missing = team.filter((t) => !t.submitted);
  const submissionRate = team.length === 0 ? 0 : Math.round((submitted.length / team.length) * 100);
  const avgProgress =
    submitted.length === 0
      ? 0
      : Math.round(submitted.reduce((a, t) => a + (t.progress ?? 0), 0) / submitted.length);

  const atRisk = submitted.filter(
    (t) => t.outlook === "blocked" || t.outlook === "need_manager_help",
  );
  const needsHelp = submitted.filter((t) => t.needsHelp);

  const byDepartment = aggregateByDepartment(submitted);
  const commonBlockers = aggregateBlockers(submitted);
  const outlookCounts = countOutlooks(submitted);

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading midday overview…</p>;
  }

  return (
    <div className="space-y-6">
      <section aria-label="Midday KPIs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Submission rate"
          value={`${submissionRate}%`}
          hint={`${submitted.length} of ${team.length} reported`}
        />
        <StatCard
          label="Avg. progress"
          value={hrMode ? "—" : `${avgProgress}%`}
          hint={hrMode ? "Hidden in HR view" : "Across submitted reports"}
        />
        <StatCard
          label="At risk"
          value={hrMode ? "—" : String(atRisk.length)}
          hint={hrMode ? "Hidden in HR view" : "Blocked or needing help"}
        />
        <StatCard
          label="Help requested"
          value={hrMode ? "—" : String(needsHelp.length)}
          hint={hrMode ? "Hidden in HR view" : "Open assistance asks"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" aria-hidden /> Missing reports
            </CardTitle>
            <CardDescription>People who haven't submitted yet.</CardDescription>
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
                      <span
                        className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold"
                        aria-hidden
                      >
                        {t.initials}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.department} · {t.role}
                        </p>
                      </div>
                    </div>
                    <StatusBadge label="Pending" size="sm" />
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
        )}
      </div>

      {hrMode ? null : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GaugeCircle className="size-4 text-info" aria-hidden /> By department
            </CardTitle>
            <CardDescription>Average progress and outlook distribution.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {byDepartment.map((d) => (
                <li key={d.department} className="space-y-2 rounded-md border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{d.department}</p>
                    <span className="text-xs tabular-nums text-muted-foreground">{d.avg}%</span>
                  </div>
                  <Progress value={d.avg} className="h-2" />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(Object.keys(d.outlook) as EndOfDayOutlook[]).map((o) => {
                      const count = d.outlook[o];
                      if (!count) return null;
                      const meta = OUTLOOK_META[o];
                      return (
                        <StatusBadge
                          key={o}
                          tone={meta.tone}
                          label={`${meta.label} · ${count}`}
                          size="sm"
                          withDot={false}
                        />
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {hrMode ? null : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outlook breakdown</CardTitle>
            <CardDescription>Where the team thinks the day lands.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {OUTLOOK_ORDER.map((id) => {
                const meta = OUTLOOK_META[id];
                const count = outlookCounts[id] ?? 0;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{meta.emoji}</span>
                      <span className="text-foreground">{meta.label}</span>
                    </span>
                    <StatusBadge tone={meta.tone} label={`${count}`} size="sm" withDot={false} />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const OUTLOOK_ORDER: EndOfDayOutlook[] = [
  "on_track",
  "need_more_time",
  "blocked",
  "need_manager_help",
];

function aggregateByDepartment(submitted: TeamMiddayEntry[]) {
  const map = new Map<
    string,
    {
      department: string;
      totalProgress: number;
      count: number;
      outlook: Record<EndOfDayOutlook, number>;
    }
  >();
  for (const t of submitted) {
    const entry = map.get(t.department) ?? {
      department: t.department,
      totalProgress: 0,
      count: 0,
      outlook: { on_track: 0, need_more_time: 0, blocked: 0, need_manager_help: 0 },
    };
    entry.totalProgress += t.progress ?? 0;
    entry.count += 1;
    if (t.outlook) entry.outlook[t.outlook] += 1;
    map.set(t.department, entry);
  }
  return Array.from(map.values())
    .map((d) => ({ ...d, avg: Math.round(d.totalProgress / d.count) }))
    .sort((a, b) => a.department.localeCompare(b.department));
}

function aggregateBlockers(submitted: TeamMiddayEntry[]) {
  const counts = new Map<string, number>();
  for (const t of submitted) {
    if (!t.topBlocker) continue;
    counts.set(t.topBlocker, (counts.get(t.topBlocker) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function countOutlooks(submitted: TeamMiddayEntry[]) {
  const counts: Partial<Record<EndOfDayOutlook, number>> = {};
  for (const t of submitted) {
    if (!t.outlook) continue;
    counts[t.outlook] = (counts[t.outlook] ?? 0) + 1;
  }
  return counts;
}

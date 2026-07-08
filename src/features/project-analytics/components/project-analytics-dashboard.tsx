import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  GaugeCircle,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { LineChart, BarChart, DonutChart, AreaChart } from "@/features/analytics/charts";
import { useTasksState } from "@/features/tasks/store";
import { useSprintsState } from "@/features/sprints/store";
import { useTimeState } from "@/features/time-tracking/store";
import { useCommState } from "@/features/task-communication/store";
import { employees } from "@/features/hr/mock-data";
import {
  type AnalyticsFilters,
  avgCycleTime,
  avgHoursPerTask,
  bottleneckStage,
  burndownMock,
  cumulativeCompletion,
  dependencyInsights,
  employeeName,
  filterProjectTasks,
  projectTimeLogs,
  snapshotTasks,
  sprintProgressList,
  sprintVelocityMock,
  sprintsForProject,
  statusDistribution,
  tasksCompletedPerDay,
  tasksCreatedPerDay,
  tasksPerUser,
  topTimeConsumingTasks,
  totalHours,
  unifiedActivity,
} from "../utils";
import { calcProjectHealth, generateInsights, type HealthLevel } from "../insights";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const HEALTH_COPY: Record<HealthLevel, { label: string; tone: string; ring: string }> = {
  good: { label: "Good", tone: "text-emerald-600", ring: "stroke-emerald-500" },
  at_risk: { label: "At Risk", tone: "text-amber-600", ring: "stroke-amber-500" },
  critical: { label: "Critical", tone: "text-red-600", ring: "stroke-red-500" },
};

export function ProjectAnalyticsDashboard({ projectId }: { projectId: string }) {
  // subscribe to live stores so derived data refreshes
  useTasksState((s) => s.tasks);
  useSprintsState((s) => s.sprints);
  useTimeState((s) => s.logs);
  useCommState((s) => s.comments.length + s.files.length);

  const [sprintId, setSprintId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [rangeStr, setRangeStr] = useState<string>("30");
  const rangeDays = Number(rangeStr);

  const filters: AnalyticsFilters = { projectId, sprintId, userId, rangeDays };
  const data = useMemo(() => {
    const tasks = filterProjectTasks(filters);
    const logs = projectTimeLogs(projectId).filter((l) => userId === "all" || l.userId === userId);
    return {
      tasks,
      snap: snapshotTasks(tasks),
      created: tasksCreatedPerDay(tasks, rangeDays),
      completed: tasksCompletedPerDay(tasks, rangeDays),
      cum: cumulativeCompletion(tasks, rangeDays),
      perUser: tasksPerUser(tasks, logs),
      logs,
      topTime: topTimeConsumingTasks(tasks, logs),
      sprints: sprintProgressList(projectId),
      velocity: sprintVelocityMock(projectId),
      burndown: burndownMock(projectId),
      statusDist: statusDistribution(tasks),
      bottleneck: bottleneckStage(tasks),
      cycle: avgCycleTime(tasks),
      dep: dependencyInsights(tasks),
      timeline: unifiedActivity(projectId, 30),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sprintId, userId, rangeDays]);

  const insights = useMemo(() => generateInsights(projectId), [projectId, data]);
  const health = useMemo(() => calcProjectHealth(projectId), [projectId, data]);
  const projectSprints = sprintsForProject(projectId);

  const hours = totalHours(data.logs);
  const avgPerTask = avgHoursPerTask(data.tasks, data.logs);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm font-medium text-muted-foreground">Filters</span>
          <Select value={sprintId} onValueChange={setSprintId}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sprints</SelectItem>
              {projectSprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {employees.slice(0, 24).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rangeStr} onValueChange={setRangeStr}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto gap-1">
            <Sparkles className="size-3" /> Read-only
          </Badge>
        </CardContent>
      </Card>

      {/* Overview KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total tasks" value={data.snap.total} icon={CheckCircle2} />
        <StatCard
          label="Completed"
          value={data.snap.completed}
          icon={TrendingUp}
          hint={`${data.snap.completionPct}% complete`}
        />
        <StatCard label="Open" value={data.snap.open} icon={Activity} />
        <StatCard
          label="Overdue"
          value={data.snap.overdue}
          icon={AlertTriangle}
          trend={
            data.snap.overdue > 0
              ? { direction: "up", value: "Needs attention", intent: "negative" }
              : undefined
          }
        />
        <StatCard
          label="Blocked"
          value={data.snap.blocked}
          icon={Flame}
          trend={
            data.snap.blocked > 0
              ? { direction: "up", value: "In dependency", intent: "negative" }
              : undefined
          }
        />
      </div>

      {/* Health + Insights */}
      <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
        <HealthCard score={health.score} level={health.level} factors={health.factors} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" /> Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {insights.map((i) => (
              <div
                key={i.id}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  i.intent === "positive" && "border-emerald-500/30 bg-emerald-500/5",
                  i.intent === "warning" && "border-amber-500/30 bg-amber-500/5",
                  i.intent === "negative" && "border-red-500/30 bg-red-500/5",
                  i.intent === "neutral" && "border-border bg-muted/30",
                )}
              >
                <p className="font-medium leading-snug">{i.title}</p>
                {i.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{i.description}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Progress analysis */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cumulative completion</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart data={data.cum} ariaLabel="Cumulative completed tasks" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={data.statusDist} ariaLabel="Tasks by status" />
          </CardContent>
        </Card>
      </div>

      {/* Task flow */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tasks created per day</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart data={data.created} ariaLabel="Tasks created" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tasks completed per day</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={data.completed}
              colorClass="stroke-success"
              ariaLabel="Tasks completed"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Bottleneck stage"
          value={data.bottleneck}
          icon={Activity}
          hint="Stage with most in-flight tasks"
        />
        <StatCard
          label="Avg cycle time"
          value={`${data.cycle}d`}
          icon={Clock}
          hint="Mock — from create → done"
        />
        <StatCard
          label="Throughput (range)"
          value={data.completed.reduce((a, b) => a + b.value, 0)}
          icon={TrendingUp}
          hint={`Last ${rangeDays} days`}
        />
      </div>

      {/* Team performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> Team performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.perUser.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No assigned tasks in this view.
            </p>
          ) : (
            data.perUser.slice(0, 10).map((u) => {
              const pct = u.total ? Math.round((u.done / u.total) * 100) : 0;
              return (
                <div key={u.userId} className="grid grid-cols-[1fr_2fr_auto] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback>{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium">{u.name}</span>
                  </div>
                  <div className="space-y-1">
                    <Progress value={pct} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {u.done}/{u.total} done · {u.open} open · {u.overdue} overdue
                    </p>
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {u.hours.toFixed(1)}h
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Workload donut */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Workload distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={data.perUser.slice(0, 6).map((u) => ({ label: u.name, value: u.total }))}
              centerLabel="Tasks"
              centerValue={String(data.snap.total)}
              ariaLabel="Tasks per user"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contribution (done)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.perUser
                .slice(0, 8)
                .map((u) => ({ label: u.name.split(" ")[0], value: u.done }))}
              colorClasses={["fill-success"]}
              ariaLabel="Completed tasks per user"
            />
          </CardContent>
        </Card>
      </div>

      {/* Time analytics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total hours" value={`${hours}h`} icon={Clock} />
        <StatCard label="Avg per task" value={`${avgPerTask}h`} icon={GaugeCircle} />
        <StatCard
          label="Tracked tasks"
          value={new Set(data.logs.map((l) => l.taskId)).size}
          icon={Activity}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top time-consuming tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topTime.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No time logged yet.</p>
          ) : (
            <ul className="divide-y">
              {data.topTime.map((t) => (
                <li key={t.taskId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    to="/app/tasks/$id"
                    params={{ id: t.taskId }}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {t.title}
                  </Link>
                  <span className="tabular-nums text-muted-foreground">{t.hours.toFixed(1)}h</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sprint analytics */}
      {projectSprints.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sprint velocity (mock)</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={data.velocity} ariaLabel="Story points per sprint" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sprint completion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.sprints.map((sp) => (
                <div key={sp.sprint.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{sp.sprint.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {sp.done}/{sp.total} · {sp.pct}%
                    </span>
                  </div>
                  <Progress value={sp.pct} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Burndown (mock — active sprint)</CardTitle>
            </CardHeader>
            <CardContent>
              <BurndownChart data={data.burndown} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Dependencies */}
      <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dependency insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Blocked tasks" value={String(data.dep.blockedCount)} />
            <Row label="Dependency chains" value={String(data.dep.chains)} />
            <Row label="Most blocking" value={data.dep.mostBlocking ?? "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dependency chain (visual)</CardTitle>
          </CardHeader>
          <CardContent>
            <DependencyChain
              blockers={data.tasks.filter((t) => t.status === "blocked").slice(0, 4)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Activity timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" /> Unified activity timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.timeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity in this project yet.
            </p>
          ) : (
            <ol className="relative ml-3 space-y-3 border-l pl-5">
              {data.timeline.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[27px] grid size-5 place-items-center rounded-full border bg-background">
                    {a.kind === "comment" ? (
                      <MessageSquare className="size-3" />
                    ) : a.kind === "file" ? (
                      <FileText className="size-3" />
                    ) : a.kind === "sprint" ? (
                      <Flame className="size-3" />
                    ) : (
                      <Activity className="size-3" />
                    )}
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <p className="min-w-0 flex-1 truncate">
                      {a.actorId ? (
                        <span className="font-medium">{employeeName(a.actorId)} · </span>
                      ) : null}
                      {a.summary}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.at).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function HealthCard({
  score,
  level,
  factors,
}: {
  score: number;
  level: HealthLevel;
  factors: { label: string; value: number; weight: number }[];
}) {
  const c = HEALTH_COPY[level];
  const r = 52,
    circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GaugeCircle className="size-4" /> Project health
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <svg viewBox="0 0 128 128" className="size-32 shrink-0">
          <circle cx="64" cy="64" r={r} className="fill-none stroke-muted" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={r}
            className={cn("fill-none transition-all", c.ring)}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            transform="rotate(-90 64 64)"
          />
          <text
            x="64"
            y="60"
            textAnchor="middle"
            className="fill-foreground text-2xl font-semibold"
          >
            {score}
          </text>
          <text x="64" y="80" textAnchor="middle" className={cn("text-xs font-medium", c.tone)}>
            {c.label}
          </text>
        </svg>
        <ul className="w-full flex-1 space-y-2">
          {factors.map((f) => (
            <li key={f.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="tabular-nums">
                  {Math.round(f.value)} · w{Math.round(f.weight * 100)}%
                </span>
              </div>
              <Progress value={f.value} className="h-1.5" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function BurndownChart({ data }: { data: { label: string; value: number; ideal: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No active sprint.</p>;
  const w = 600,
    h = 220,
    pad = { t: 12, r: 12, b: 24, l: 32 };
  const iw = w - pad.l - pad.r,
    ih = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => Math.max(d.value, d.ideal)), 1);
  const x = (i: number) => pad.l + (i * iw) / Math.max(1, data.length - 1);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const actual = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const ideal = data.map((d, i) => `${x(i)},${y(d.ideal)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Burndown chart">
      <polyline
        fill="none"
        className="stroke-muted-foreground/40"
        strokeWidth="2"
        strokeDasharray="4 4"
        points={ideal}
      />
      <polyline fill="none" className="stroke-primary" strokeWidth="2.5" points={actual} />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r="3" className="fill-primary" />
          <text
            x={x(i)}
            y={h - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DependencyChain({ blockers }: { blockers: { id: string; title: string; ref: string }[] }) {
  if (blockers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No blocked tasks. Dependency graph is clear.</p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {blockers.map((b, i) => (
        <div key={b.id} className="flex items-center gap-2">
          <Link
            to="/app/tasks/$id"
            params={{ id: b.id }}
            className="rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 font-medium hover:bg-red-500/10"
          >
            <span className="mr-1 font-mono text-[10px] text-muted-foreground">{b.ref}</span>
            {b.title}
          </Link>
          {i < blockers.length - 1 ? <span className="text-muted-foreground">→</span> : null}
        </div>
      ))}
    </div>
  );
}

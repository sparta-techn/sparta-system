import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Folder, Tag, User2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  PersonChip,
  PriorityPill,
  StatePill,
  TypePill,
} from "@/features/dependencies/components/dep-badges";
import { DepComments } from "@/features/dependencies/components/dep-comments";
import { DepTimeline } from "@/features/dependencies/components/dep-timeline";
import { personById } from "@/features/dependencies/mock-data";
import { dependencyStore, useDependency } from "@/features/dependencies/store";
import {
  DEPENDENCY_PRIORITIES,
  DEPENDENCY_STATES,
  PRIORITY_LABEL,
  STATE_LABEL,
  type DependencyPriority,
  type DependencyState,
} from "@/features/dependencies/types";
import { dueLabel, isOverdue, timeAgo } from "@/features/dependencies/utils";

export const Route = createFileRoute("/_authenticated/app/dependencies/$id")({
  loader: ({ params }) => {
    const dep = dependencyStore.get(params.id);
    if (!dep) throw notFound();
    return { id: params.id };
  },
  component: DependencyDetail,
  notFoundComponent: () => (
    <div className="space-y-3">
      <PageHeader title="Dependency not found" description="It may have been deleted or moved." />
      <Link to="/app/dependencies" className="text-sm text-primary hover:underline">
        Back to dependencies
      </Link>
    </div>
  ),
});

function DependencyDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const dep = useDependency(id);

  if (!dep) return null;

  const requester = personById(dep.requesterId);
  const owner = personById(dep.ownerId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/dependencies" })}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{dep.id}</span>
      </div>

      <PageHeader
        eyebrow={dep.project}
        title={dep.title}
        description={dep.description || "No description provided."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={dep.state}
              onValueChange={(v) => {
                dependencyStore.setState(dep.id, v as DependencyState);
                toast.success(`Status → ${STATE_LABEL[v as DependencyState]}`);
              }}
            >
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPENDENCY_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{STATE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={dep.priority}
              onValueChange={(v) => {
                dependencyStore.setPriority(dep.id, v as DependencyPriority);
                toast.success(`Priority → ${PRIORITY_LABEL[v as DependencyPriority]}`);
              }}
            >
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPENDENCY_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatePill state={dep.state} />
            <PriorityPill priority={dep.priority} />
            <TypePill type={dep.type} />
            {dep.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Tag className="size-3" /> {t}
              </span>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {dep.description || "No description provided."}
              </p>
              {dep.relatedTaskRef && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Related task: <span className="font-mono text-foreground">{dep.relatedTaskRef}</span>{" "}
                  <span className="italic">(ClickUp link — coming soon)</span>
                </p>
              )}
              {dep.attachments.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {dep.attachments.map((a) => (
                    <li key={a.id} className="text-xs text-muted-foreground">
                      📎 {a.name} <span className="text-[10px]">({a.size})</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <DepComments dep={dep} />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <Row label="Requester">
                {requester ? <PersonChip name={requester.name} color={requester.avatarColor} sub={requester.role} /> : "—"}
              </Row>
              <Row label="Owner">
                {owner ? (
                  <PersonChip name={owner.name} color={owner.avatarColor} sub={owner.role} />
                ) : (
                  <span className="italic text-muted-foreground">Unassigned</span>
                )}
              </Row>
              <Separator />
              <Row label="Department" icon={<User2 className="size-3" />}>
                {dep.department}
              </Row>
              <Row label="Project" icon={<Folder className="size-3" />}>
                {dep.project}
              </Row>
              <Row label="Created">{new Date(dep.createdAt).toLocaleString()}</Row>
              <Row label="Updated">{timeAgo(dep.updatedAt)}</Row>
              <Row label="Due" icon={<CalendarClock className="size-3" />}>
                <span className={isOverdue(dep) ? "text-destructive" : ""}>{dueLabel(dep)}</span>
              </Row>
              {dep.resolvedAt && (
                <Row label="Resolved">{new Date(dep.resolvedAt).toLocaleString()}</Row>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <DepTimeline dep={dep} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right text-xs text-foreground">{children}</span>
    </div>
  );
}

import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/states";
import { mockDependencies, type MockDependency } from "../mock-data";

const PRIORITY_TONE: Record<MockDependency["priority"], "neutral" | "info" | "warning" | "danger"> =
  {
    low: "neutral",
    medium: "info",
    high: "warning",
    urgent: "danger",
  };

export function DependenciesWidget() {
  const waiting = mockDependencies.filter((d) => d.direction === "waiting");
  const blocking = mockDependencies.filter((d) => d.direction === "blocking");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Dependencies</CardTitle>
          <CardDescription>
            What you're waiting on and what others are waiting on from you.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm">
          <Plus /> New
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="waiting">
          <TabsList className="mb-3">
            <TabsTrigger value="waiting" className="gap-1.5">
              <ArrowDownLeft className="size-3.5" /> Waiting · {waiting.length}
            </TabsTrigger>
            <TabsTrigger value="blocking" className="gap-1.5">
              <ArrowUpRight className="size-3.5" /> Blocking · {blocking.length}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="waiting" className="space-y-2">
            {waiting.length === 0 ? (
              <EmptyState title="No open dependencies" description="You're clear to focus." />
            ) : (
              waiting.map((d) => <DependencyRow key={d.id} dep={d} />)
            )}
          </TabsContent>
          <TabsContent value="blocking" className="space-y-2">
            {blocking.length === 0 ? (
              <EmptyState title="Nothing blocking others" description="Nice — keep it that way." />
            ) : (
              blocking.map((d) => <DependencyRow key={d.id} dep={d} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DependencyRow({ dep }: { dep: MockDependency }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-muted text-foreground text-[10px] font-semibold">
          {dep.counterparty.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">{dep.title}</p>
        <p className="text-xs text-muted-foreground">
          {dep.counterparty.name} · {dep.counterparty.department} · {dep.createdAgo}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <StatusBadge status={dep.status} size="sm" />
          <StatusBadge
            tone={PRIORITY_TONE[dep.priority]}
            label={dep.priority.toUpperCase()}
            size="sm"
            withDot={false}
          />
        </div>
      </div>
    </div>
  );
}

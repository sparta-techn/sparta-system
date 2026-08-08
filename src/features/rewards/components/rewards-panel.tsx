/**
 * Rewards workspace — send a reward to one employee, and the full history.
 *
 * v1 is deliberately one-employee-at-a-time: each send is an explicit
 * per-row click through the dialog.
 * TODO(follow-up): bulk / multi-select sending is out of v1 scope.
 *
 * The history tab shows every reward row with its actual outcome — a `failed`
 * row surfaces its captured `error_message` (tooltip), never a silent gap —
 * and offers a retry for anything not `sent`.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Gift, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/features/payroll/summary";
import { hrQueries } from "@/features/hr/queries";
import type { HrEmployee } from "@/features/hr/mock-data";
import type { Reward } from "@/services/hr";

import { rewardsHistoryQuery, rewardKeys } from "../queries";
import { sendRewardFn } from "../rewards.functions";
import { SendRewardDialog } from "./send-reward-dialog";

export function RewardsPanel() {
  const employeesQuery = useQuery(hrQueries.employees());
  const [rewardFor, setRewardFor] = useState<HrEmployee | null>(null);

  return (
    <>
      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Send reward</TabsTrigger>
          <TabsTrigger value="history">Reward history</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <Card>
            <CardContent className="pt-6">
              {employeesQuery.isPending ? (
                <ListSkeleton rows={6} />
              ) : employeesQuery.isError ? (
                <ErrorState
                  title="Couldn't load employees"
                  description={getErrorMessage(employeesQuery.error)}
                  action={
                    <Button variant="outline" onClick={() => employeesQuery.refetch()}>
                      Retry
                    </Button>
                  }
                />
              ) : (employeesQuery.data?.length ?? 0) === 0 ? (
                <EmptyState
                  title="No employees"
                  description="Invite employees before sending rewards."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Reward</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeesQuery.data!.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-xs text-muted-foreground">{e.email}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{e.department}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {e.employmentType}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-xs"
                              onClick={() => setRewardFor(e)}
                            >
                              <Gift className="size-3" />
                              Send reward
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <RewardHistory employees={employeesQuery.data ?? []} />
        </TabsContent>
      </Tabs>

      <SendRewardDialog
        employee={rewardFor}
        open={rewardFor !== null}
        onOpenChange={(open) => !open && setRewardFor(null)}
      />
    </>
  );
}

function RewardHistory({ employees }: { employees: HrEmployee[] }) {
  const q = useQuery(rewardsHistoryQuery());
  const nameById = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);

  return (
    <Card>
      <CardContent className="pt-6">
        {q.isPending ? (
          <ListSkeleton rows={6} />
        ) : q.isError ? (
          <ErrorState
            title="Couldn't load reward history"
            description={getErrorMessage(q.error)}
            action={
              <Button variant="outline" onClick={() => q.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No rewards yet"
            description="Rewards you send will be recorded here for HR record-keeping."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data!.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {nameById.get(r.employee_id) ?? "Former employee"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.amount, r.currency)}
                    </TableCell>
                    <TableCell
                      className="max-w-56 truncate text-muted-foreground"
                      title={r.reason ?? undefined}
                    >
                      {r.reason || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.sent_at ?? r.created_at).toLocaleDateString([], {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <RewardStatusCell reward={r} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The reward's actual outcome. A failed send shows WHY (the recorded
 * `error_message`) and offers a retry; `pending` means the send never
 * completed (e.g. the tab closed mid-flight) and is retryable too.
 */
function RewardStatusCell({ reward }: { reward: Reward }) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => sendRewardFn({ data: { rewardId: reward.id } }),
    onSuccess: (result) => {
      toast.success(`Reward sent to ${result.recipientEmail}.`);
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
    },
  });

  if (reward.status === "sent") {
    return (
      <Badge variant="outline" className="gap-1 text-success">
        <CheckCircle2 className="size-3" />
        Sent
      </Badge>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {reward.status === "failed" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-destructive">
              <AlertTriangle className="size-3" />
              Failed
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-72">
            {reward.error_message ?? "The email could not be sent."}
          </TooltipContent>
        </Tooltip>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="size-3" />
          Pending
        </Badge>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={retry.isPending}
        onClick={() => retry.mutate()}
      >
        <RotateCcw className="size-3" />
        Retry
      </Button>
    </div>
  );
}

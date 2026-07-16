import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, UserCog, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDurationLong } from "@/features/attendance/hooks/use-timer";
import { overtimeWorkedSeconds } from "@/features/overtime/pay";

import { approveOvertime, rejectOvertime } from "../api";
import { pendingOvertimeQueueQuery, overtimeKeys } from "../queries";
import type { OvertimeQueueRow } from "../types";

export function OvertimeApprovalQueue() {
  const qc = useQueryClient();
  const queueQ = useQuery(pendingOvertimeQueueQuery());
  const [rejecting, setRejecting] = useState<OvertimeQueueRow | null>(null);
  const [reason, setReason] = useState("");

  const invalidate = () => void qc.invalidateQueries({ queryKey: overtimeKeys.queue() });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveOvertime(id),
    onSuccess: () => {
      toast.success("Overtime approved.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => rejectOvertime(id, why),
    onSuccess: () => {
      toast.success("Overtime rejected.");
      setRejecting(null);
      setReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (queueQ.isPending) {
    return <p className="text-sm text-muted-foreground">Loading pending overtime…</p>;
  }
  const rows = queueQ.data ?? [];
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Check className="size-4 text-success" aria-hidden />
          No overtime awaiting approval.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {rows.map((row) => {
          const { session, employee } = row;
          const name = employee.display_name ?? employee.full_name ?? "Unknown";
          const worked = overtimeWorkedSeconds(session.start_time, session.end_time);
          const busy = approveMut.isPending || rejectMut.isPending;
          return (
            <li key={session.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <Avatar className="size-9">
                    {employee.avatar_url ? <AvatarImage src={employee.avatar_url} alt="" /> : null}
                    <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{name}</span>
                      {employee.employee_code ? (
                        <span className="text-xs text-muted-foreground">
                          {employee.employee_code}
                        </span>
                      ) : null}
                      {session.requested_by ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <UserCog className="size-3" aria-hidden /> Manager-requested
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Self-started
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{session.work_date}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        {formatDurationLong(worked)}
                      </span>
                      {session.notes ? <span className="truncate">“{session.notes}”</span> : null}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setRejecting(row)}
                      aria-label={`Reject overtime for ${name}`}
                    >
                      <X /> Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => approveMut.mutate(session.id)}
                      aria-label={`Approve overtime for ${name}`}
                    >
                      {approveMut.isPending && approveMut.variables === session.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!rejecting}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject overtime</DialogTitle>
            <DialogDescription>
              A reason is required and is shown to the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              rows={3}
              placeholder="e.g. Not pre-approved for this date."
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRejecting(null);
                setReason("");
              }}
              disabled={rejectMut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || rejectMut.isPending}
              onClick={() =>
                rejecting && rejectMut.mutate({ id: rejecting.session.id, why: reason.trim() })
              }
            >
              {rejectMut.isPending ? <Loader2 className="animate-spin" /> : null}
              Reject overtime
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

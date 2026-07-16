import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hrQueries } from "@/features/hr/queries";

import { requestOvertime } from "../api";
import { overtimeKeys } from "../queries";

/** Today's date as `YYYY-MM-DD` in local time (default request date). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Manager action: proactively request overtime for an employee on a date. The
 * request pre-fills a pending session (no times); the employee clocks into it
 * when they start overtime that day.
 */
export function RequestOvertimeDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [workDate, setWorkDate] = useState<string>(todayIso());
  const [notes, setNotes] = useState<string>("");

  const employeesQ = useQuery(hrQueries.employees());

  const mut = useMutation({
    mutationFn: () => requestOvertime(employeeId, workDate, notes.trim() || undefined),
    onSuccess: () => {
      toast.success("Overtime requested for the employee.");
      void qc.invalidateQueries({ queryKey: overtimeKeys.queue() });
      setOpen(false);
      setEmployeeId("");
      setNotes("");
      setWorkDate(todayIso());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = !!employeeId && !!workDate && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarPlus /> Request overtime
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request overtime</DialogTitle>
          <DialogDescription>
            Ask an employee to log overtime on a specific day. They clock into this request when
            they start; you approve it once the hours are logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ot-employee">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="ot-employee">
                <SelectValue
                  placeholder={employeesQ.isPending ? "Loading…" : "Select an employee"}
                />
              </SelectTrigger>
              <SelectContent>
                {(employeesQ.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.employmentType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ot-date">Date</Label>
            <Input
              id="ot-date"
              type="date"
              value={workDate}
              onChange={(ev) => setWorkDate(ev.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ot-notes">Note (optional)</Label>
            <Textarea
              id="ot-notes"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              placeholder="Context for the employee — e.g. release night, on-call cover."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? <Loader2 className="animate-spin" /> : null}
            Request overtime
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

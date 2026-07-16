import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hrQueries } from "@/features/hr/queries";

import {
  createAttendanceException,
  deleteAttendanceException,
  updateAttendanceException,
  type AttendanceException,
} from "../exceptions-api";
import { exceptionKeys } from "../exceptions-queries";

/** Today as `YYYY-MM-DD` (local). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  /** Present → edit mode (employee + date locked, Delete available). */
  existing?: AttendanceException;
  /** Prefill the employee in create mode. */
  defaultEmployeeId?: string;
  /** Prefill the date in create mode. */
  defaultDate?: string;
  /** Custom trigger; defaults to an "Add exception" button. */
  trigger?: ReactNode;
}

/**
 * Manager/HR/Admin/Owner action: log (or edit) a paid/unpaid attendance
 * exception for an employee's shortfall on a specific day. RLS is the
 * authoritative gate on the write.
 */
export function AddExceptionDialog({ existing, defaultEmployeeId, defaultDate, trigger }: Props) {
  const qc = useQueryClient();
  const isEdit = !!existing;
  const [open, setOpen] = useState(false);

  const [employeeId, setEmployeeId] = useState(existing?.employee_id ?? defaultEmployeeId ?? "");
  const [date, setDate] = useState(existing?.exception_date ?? defaultDate ?? todayIso());
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [paid, setPaid] = useState<boolean>(existing?.paid ?? true);
  const [hours, setHours] = useState<string>(
    existing && existing.adjustment_minutes ? String(existing.adjustment_minutes / 60) : "",
  );

  // Reset the form to the source of truth whenever the dialog (re)opens.
  useEffect(() => {
    if (!open) return;
    setEmployeeId(existing?.employee_id ?? defaultEmployeeId ?? "");
    setDate(existing?.exception_date ?? defaultDate ?? todayIso());
    setReason(existing?.reason ?? "");
    setPaid(existing?.paid ?? true);
    setHours(
      existing && existing.adjustment_minutes ? String(existing.adjustment_minutes / 60) : "",
    );
  }, [open, existing, defaultEmployeeId, defaultDate]);

  const employeesQ = useQuery({ ...hrQueries.employees(), enabled: open });
  const editingName = isEdit
    ? (employeesQ.data?.find((e) => e.id === existing.employee_id)?.name ?? "Employee")
    : "";

  const invalidate = () => void qc.invalidateQueries({ queryKey: exceptionKeys.all });
  const adjustmentMinutes = Math.round((Number(hours) || 0) * 60);

  const saveMut = useMutation({
    mutationFn: () =>
      isEdit
        ? updateAttendanceException(existing.id, { reason: reason.trim(), paid, adjustmentMinutes })
        : createAttendanceException({
            employeeId,
            date,
            reason: reason.trim(),
            paid,
            adjustmentMinutes,
          }),
    onSuccess: () => {
      toast.success(isEdit ? "Exception updated." : "Exception logged.");
      invalidate();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteAttendanceException(existing!.id),
    onSuccess: () => {
      toast.success("Exception removed.");
      invalidate();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = saveMut.isPending || deleteMut.isPending;
  const canSave = !!employeeId && !!date && !!reason.trim() && !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Add exception</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit attendance exception" : "Add attendance exception"}
          </DialogTitle>
          <DialogDescription>
            Excuse or adjust a day&apos;s attendance for an employee. The reason is recorded and
            visible for audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exc-employee">Employee</Label>
            {isEdit ? (
              <Input id="exc-employee" value={editingName} disabled readOnly />
            ) : (
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger id="exc-employee">
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
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exc-date">Date</Label>
              <Input
                id="exc-date"
                type="date"
                value={date}
                disabled={isEdit}
                onChange={(ev) => setDate(ev.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exc-hours">Excused time (hours)</Label>
              <Input
                id="exc-hours"
                type="number"
                min={0}
                step={0.25}
                value={hours}
                onChange={(ev) => setHours(ev.target.value)}
                placeholder="e.g. 2"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment</Label>
            <RadioGroup
              value={paid ? "paid" : "unpaid"}
              onValueChange={(v) => setPaid(v === "paid")}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="paid" id="exc-paid" />
                <Label htmlFor="exc-paid" className="font-normal">
                  Paid
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="unpaid" id="exc-unpaid" />
                <Label htmlFor="exc-unpaid" className="font-normal">
                  Unpaid
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exc-reason">Reason (required)</Label>
            <Textarea
              id="exc-reason"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              rows={3}
              placeholder="e.g. Approved medical appointment; power outage at home."
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteMut.mutate()}
              disabled={busy}
            >
              {deleteMut.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave}>
              {saveMut.isPending ? <Loader2 className="animate-spin" /> : null}
              {isEdit ? "Save changes" : "Log exception"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

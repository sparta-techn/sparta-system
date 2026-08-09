/**
 * "Correct a sent payslip" form.
 *
 * Records that a figure on an already-sent payslip was wrong, and what it should
 * be. It deliberately sends NOTHING: the employee is only told once someone
 * explicitly clicks "Resend corrected payslip", so a typo fixed for the record
 * does not have to mean a second email.
 *
 * Overtime is corrected in HOURS, not money — the pay is re-derived from the
 * hours on the server using the payroll report's own rate, so the payslip's
 * "N hours approved — X" line always reconciles.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { getErrorMessage } from "@/lib/errors";

import { payrollKeys } from "../queries";
import {
  logPayslipCorrectionFn,
  type CorrectableField,
  type CorrectionState,
} from "../payslip.functions";
import { formatMoney } from "../summary";
import type { PayrollLine } from "../types";

interface CorrectPayslipDialogProps {
  line: PayrollLine | null;
  /** Existing corrections for this employee+period, if any. */
  state?: CorrectionState;
  periodLabel: string;
  from: string;
  to: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const n = (v: number | null | undefined) => Number(v ?? 0);

export function CorrectPayslipDialog({
  line,
  state,
  periodLabel,
  from,
  to,
  open,
  onOpenChange,
}: CorrectPayslipDialogProps) {
  const queryClient = useQueryClient();
  const [field, setField] = useState<CorrectableField>("base_pay");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  // The figure currently in effect: the computed line, plus anything corrected
  // since. Correcting twice must start from the last correction, not the
  // original payslip.
  const current = useMemo(() => {
    const basePay = state?.effective?.basePay ?? n(line?.base_pay);
    const overtimeHours = state?.effective?.overtimeHours ?? n(line?.overtime_hours);
    return { base_pay: basePay, overtime_hours: overtimeHours };
  }, [state, line]);

  // Never carry one employee's half-typed correction into another's dialog.
  useEffect(() => {
    if (open) {
      setField("base_pay");
      setValue("");
      setReason("");
    }
  }, [open, line?.employee_id]);

  const mutation = useMutation({
    mutationFn: () =>
      logPayslipCorrectionFn({
        data: {
          employeeId: line!.employee_id!,
          from,
          to,
          field,
          newValue: Number(value),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success(
        `Correction logged for ${line?.employee_name}. The payslip email was not resent.`,
      );
      void queryClient.invalidateQueries({ queryKey: payrollKeys.corrections(from, to) });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!line) return null;

  const isMoney = field === "base_pay";
  const currentValue = current[field];
  const parsed = Number(value);
  const valueValid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const changed = valueValid && Math.abs(parsed - currentValue) > 0.005;
  const canSave = changed && reason.trim().length > 0 && !mutation.isPending;

  const show = (v: number) =>
    isMoney ? formatMoney(v, line.currency) : `${v} hour${v === 1 ? "" : "s"}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Correct sent payslip</DialogTitle>
          <DialogDescription>
            {line.employee_name} · {periodLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="correction-field">Figure to correct</Label>
            <Select value={field} onValueChange={(v) => setField(v as CorrectableField)}>
              <SelectTrigger id="correction-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base_pay">Base pay</SelectItem>
                <SelectItem value="overtime_hours">Overtime hours</SelectItem>
              </SelectContent>
            </Select>
            {!isMoney ? (
              <p className="text-xs text-muted-foreground">
                Overtime pay is recalculated from these hours at this employee&apos;s overtime rate,
                so the payslip always adds up.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-value">
              Corrected {isMoney ? "base pay" : "overtime hours"}
            </Label>
            <Input
              id="correction-value"
              type="number"
              min="0"
              step={isMoney ? "0.01" : "0.25"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={String(currentValue)}
            />
            <p className="text-xs text-muted-foreground">
              Currently {show(currentValue)}
              {changed ? ` → ${show(parsed)}` : ""}.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correction-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="correction-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this figure being changed?"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Required. Every correction to someone&apos;s pay is recorded with its reason.
            </p>
          </div>

          <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            This will be logged against the payslip and{" "}
            <strong className="font-medium text-foreground">
              does not resend the payslip email
            </strong>
            . Use &ldquo;Resend corrected payslip&rdquo; afterwards if the employee should be told.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <PencilLine />}
            Log correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

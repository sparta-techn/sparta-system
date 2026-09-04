/**
 * "Mark as paid & send payslip" confirmation.
 *
 * The deliberate step between a real bank transfer and telling an employee it
 * happened. It shows the exact figures the email will carry (straight from the
 * payroll line the table is already displaying) and requires the sender to
 * affirm the transfer completed — this action asserts that money moved, and no
 * email should go out on a mis-click.
 *
 * A resend needs a SECOND, separate affirmation, so "already paid" can never be
 * clicked past without noticing.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Mail, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { isFeatureInMvp } from "@/config/mvp-scope";
import { getErrorMessage } from "@/lib/errors";

import { payrollKeys } from "../queries";
import {
  sendPayslipFn,
  type CorrectionState,
  type PayslipDeliveryRecord,
} from "../payslip.functions";
import { formatMoney } from "../summary";
import type { PayrollLine } from "../types";

interface MarkPaidDialogProps {
  line: PayrollLine | null;
  periodLabel: string;
  from: string;
  to: string;
  /** Previous send for this employee+period, if any. */
  delivery?: PayslipDeliveryRecord;
  /** Corrections logged against this employee's payslip, if any. */
  correction?: CorrectionState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const n = (v: number | null | undefined) => Number(v ?? 0);

/** Overtime is removed from the product; the payslip no longer breaks it out. */
const SHOW_OVERTIME = isFeatureInMvp("overtime");

export function MarkPaidDialog({
  line,
  periodLabel,
  from,
  to,
  delivery,
  correction,
  open,
  onOpenChange,
}: MarkPaidDialogProps) {
  const queryClient = useQueryClient();
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [resendConfirmed, setResendConfirmed] = useState(false);

  // Never carry a previous confirmation into the next employee's dialog.
  useEffect(() => {
    if (open) {
      setTransferConfirmed(false);
      setResendConfirmed(false);
    }
  }, [open, line?.employee_id]);

  const alreadyPaid = Boolean(delivery);

  const mutation = useMutation({
    mutationFn: () =>
      sendPayslipFn({
        data: {
          employeeId: line!.employee_id!,
          from,
          to,
          periodLabel,
          confirmResend: alreadyPaid,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        result.correctionsApplied > 0
          ? `Corrected payslip sent to ${result.recipientEmail}.`
          : result.attempt > 1
            ? `Payslip resent to ${result.recipientEmail}.`
            : `${line?.employee_name} marked paid — payslip sent to ${result.recipientEmail}.`,
      );
      void queryClient.invalidateQueries({ queryKey: payrollKeys.deliveries(from, to) });
      void queryClient.invalidateQueries({ queryKey: payrollKeys.corrections(from, to) });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!line) return null;

  const money = (v: number | null | undefined) => formatMoney(v, line.currency);

  // Pending corrections are applied by THIS send. Show the figures that will
  // actually be emailed — computed server-side by the same code that sends —
  // rather than the superseded ones the payroll report still calculates.
  const eff = correction?.effective ?? null;
  const pendingCount = correction?.pendingCount ?? 0;
  const basePay = eff?.basePay ?? n(line.base_pay);
  const overtimeHours = eff?.overtimeHours ?? n(line.overtime_hours);
  const overtimePay = eff?.overtimePay ?? n(line.overtime_pay);
  const totalPay = eff?.totalPay ?? n(line.total_pay);

  // Overtime is removed from the pipeline, so the report never reports it. A
  // historical correction row can still carry a non-zero figure, hence the
  // explicit scope gate rather than relying on the value being zero.
  const hasOvertime = SHOW_OVERTIME && (overtimeHours > 0 || overtimePay > 0);
  const unpaidNotes: string[] = [];
  if (n(line.absence_days) > 0) unpaidNotes.push(`${n(line.absence_days)} unpaid absence day(s)`);
  if (n(line.unpaid_exception_count) > 0) {
    unpaidNotes.push(`${n(line.unpaid_exception_count)} unpaid exception(s)`);
  }

  const canSend = transferConfirmed && (!alreadyPaid || resendConfirmed) && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as paid &amp; send payslip</DialogTitle>
          <DialogDescription>
            {line.employee_name} · {periodLabel}
          </DialogDescription>
        </DialogHeader>

        {alreadyPaid ? (
          <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning-soft/40 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Already marked paid on {new Date(delivery!.paidAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Sent to {delivery!.recipientEmail}
                {delivery!.attempt > 1 ? ` · ${delivery!.attempt} sends so far` : ""}. Sending again
                emails them a second payslip for the same month.
              </p>
            </div>
          </div>
        ) : null}

        {pendingCount > 0 ? (
          <div className="flex gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <PencilLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              This send applies{" "}
              <strong className="font-medium text-foreground">
                {pendingCount} logged correction{pendingCount === 1 ? "" : "s"}
              </strong>
              . The figures below are the corrected ones, and they are what the employee will be
              emailed.
            </p>
          </div>
        ) : null}

        {/* The exact figures the email will carry — corrected where corrections apply. */}
        <dl className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Base pay</dt>
            <dd className="tabular-nums">{money(basePay)}</dd>
          </div>
          {hasOvertime ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Overtime ({overtimeHours}h approved)</dt>
              <dd className="tabular-nums">{money(overtimePay)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(totalPay)}</dd>
          </div>
          {unpaidNotes.length > 0 ? (
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              The payslip will also show {unpaidNotes.join(" and ")}.
            </p>
          ) : null}
        </dl>

        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="payslip-transfer-confirmed"
              checked={transferConfirmed}
              onCheckedChange={(v) => setTransferConfirmed(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="payslip-transfer-confirmed"
              className="text-sm font-normal leading-snug text-foreground"
            >
              I have confirmed the bank transfer of {money(totalPay)} to {line.employee_name}{" "}
              actually went through.
            </Label>
          </div>

          {alreadyPaid ? (
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="payslip-resend-confirmed"
                checked={resendConfirmed}
                onCheckedChange={(v) => setResendConfirmed(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="payslip-resend-confirmed"
                className="text-sm font-normal leading-snug text-foreground"
              >
                Yes, send this payslip again — I know they have already received one.
              </Label>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSend}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
            {pendingCount > 0
              ? "Send corrected payslip"
              : alreadyPaid
                ? "Resend payslip"
                : "Mark paid & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

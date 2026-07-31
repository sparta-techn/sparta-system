import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, Mail } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { downloadPayrollWorkbook } from "../export";
import {
  asOfDate,
  currentMonth,
  monthBounds,
  payrollReportQuery,
  payslipDeliveriesQuery,
} from "../queries";
import { formatMoney } from "../summary";
import type { PayrollLine } from "../types";
import { MarkPaidDialog } from "./mark-paid-dialog";

export function PayrollExportPanel() {
  const [month, setMonth] = useState<string>(currentMonth());
  const { from, to, label } = monthBounds(month);
  const asOf = asOfDate(to);

  const q = useQuery(payrollReportQuery(from, to));
  // Who has already been marked paid this period — never used to send anything,
  // only to show it and to force a resend to be explicit.
  const deliveriesQuery = useQuery(payslipDeliveriesQuery(from, to));
  const deliveries = deliveriesQuery.data;

  const [payslipFor, setPayslipFor] = useState<PayrollLine | null>(null);

  const lines = q.data ?? [];
  const grandTotal = lines.reduce((sum, l) => sum + Number(l.total_pay ?? 0), 0);
  const currency = lines[0]?.currency ?? "EGP";
  const missing = lines.filter((l) => !l.has_pay_data).length;

  function handleExport() {
    if (lines.length === 0) {
      toast.info("Nothing to export for this month.");
      return;
    }
    downloadPayrollWorkbook(from, lines);
    toast.success(
      `Exported ${lines.length} employee row${lines.length === 1 ? "" : "s"} to Excel.`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">Month-end payroll · {label}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Every figure comes from the server-side payroll calculation. As of {asOf}
              {to > asOf ? " (month in progress — a live snapshot of elapsed days)" : ""}.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="payroll-month" className="text-xs">
                Month
              </Label>
              <Input
                id="payroll-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || currentMonth())}
                className="w-40"
              />
            </div>
            <Button onClick={handleExport} disabled={q.isPending || lines.length === 0}>
              <Download /> Export .xlsx
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isPending ? (
          <ListSkeleton rows={6} />
        ) : q.isError ? (
          <ErrorState
            title="Couldn't calculate payroll"
            description={(q.error as Error)?.message ?? "Please try again."}
            action={
              <Button variant="outline" onClick={() => q.refetch()}>
                Retry
              </Button>
            }
          />
        ) : lines.length === 0 ? (
          <EmptyState
            title="No employees for this month"
            description="No active employees fall within the selected period."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {lines.length} employee{lines.length === 1 ? "" : "s"}
              </span>
              <span className="font-medium text-foreground tabular-nums">
                Total payroll {formatMoney(grandTotal, currency)}
              </span>
              {missing > 0 ? (
                <span className="text-warning">
                  {missing} without a pay rate configured (shown as 0)
                </span>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Present / Exp.</TableHead>
                    <TableHead className="text-right">Worked h</TableHead>
                    <TableHead className="text-right">Exc. (p/u)</TableHead>
                    <TableHead className="text-right">Absence</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">OT h</TableHead>
                    <TableHead className="text-right">OT pay</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.employee_id}>
                      <TableCell className="font-medium">
                        {l.employee_name}
                        {!l.has_pay_data ? (
                          <Badge variant="outline" className="ml-2 text-warning">
                            no rate
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.employment_type}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.employment_type === "part-time"
                          ? "—"
                          : `${l.present_days} / ${l.expected_days}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.worked_hours}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.paid_exception_count}/{l.unpaid_exception_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.employment_type === "part-time" ? "—" : (l.absence_days ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(l.base_pay, l.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.overtime_hours}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(l.overtime_pay, l.currency)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatMoney(l.total_pay, l.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <PayslipCell
                          line={l}
                          paidAt={deliveries?.get(l.employee_id ?? "")?.paidAt}
                          onOpen={() => setPayslipFor(l)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      <MarkPaidDialog
        line={payslipFor}
        periodLabel={label}
        from={from}
        to={to}
        delivery={payslipFor?.employee_id ? deliveries?.get(payslipFor.employee_id) : undefined}
        open={payslipFor !== null}
        onOpenChange={(open) => !open && setPayslipFor(null)}
      />
    </Card>
  );
}

interface PayslipCellProps {
  line: PayrollLine;
  /** ISO timestamp of the last send for this period, if any. */
  paidAt?: string;
  onOpen: () => void;
}

/**
 * Per-employee payslip action. One explicit click per employee — there is no
 * "send all", and the .xlsx export never triggers this.
 */
function PayslipCell({ line, paidAt, onOpen }: PayslipCellProps) {
  // Nothing to confirm as paid: no rate configured, or a zero total.
  const blocked = !line.has_pay_data || Number(line.total_pay ?? 0) <= 0;

  if (blocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent>
          {line.has_pay_data
            ? "Total is zero — nothing to mark as paid."
            : "No pay rate configured for this employee."}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (paidAt) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <Badge variant="outline" className="gap-1 text-success">
          <CheckCircle2 className="size-3" />
          Paid {new Date(paidAt).toLocaleDateString([], { day: "numeric", month: "short" })}
        </Badge>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onOpen}>
          Resend
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={onOpen}>
      <Mail className="size-3" />
      Mark paid &amp; send
    </Button>
  );
}

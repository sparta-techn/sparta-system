import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { overtimePaySummaryQuery } from "../queries";

/** First and last day of the month containing `ref`, as `YYYY-MM-DD`. */
function monthBounds(ref: Date): { from: string; to: string; label: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from: iso(new Date(y, m, 1)),
    to: iso(new Date(y, m + 1, 0)),
    label: ref.toLocaleDateString([], { month: "long", year: "numeric" }),
  };
}

const money = (n: number, currency: string) =>
  `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

/**
 * Approved overtime pay for the current month, per employee. Every amount is
 * sourced from the authoritative `overtime_pay_report` RPC — the same function
 * the Phase-4 payroll export reads. Render only for `payroll.view` holders.
 */
export function OvertimePayPanel() {
  const { from, to, label } = monthBounds(new Date());
  const summaryQ = useQuery(overtimePaySummaryQuery(from, to));

  const rows = summaryQ.data ?? [];
  const grandTotal = rows.reduce((sum, r) => sum + r.totalAmount, 0);
  const currency = rows[0]?.currency ?? "EGP";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="size-4 text-muted-foreground" aria-hidden />
          Approved overtime pay · {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summaryQ.isPending ? (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved overtime this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.sessionCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(r.totalAmount, r.currency)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {money(grandTotal, currency)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Expandable correction history for one employee's payslip.
 *
 * Reads as a chain: each entry says which figure changed, from what to what,
 * why, who changed it, and — crucially — whether the employee has actually been
 * told yet. A correction that has been logged but not re-sent is called out as
 * "not resent", because until then the employee still holds the wrong figure.
 */
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { CorrectionState, PayslipCorrection } from "../payslip.functions";
import { formatMoney } from "../summary";

interface PayslipEditHistoryProps {
  state: CorrectionState;
  currency: string | null;
}

export function PayslipEditHistory({ state, currency }: PayslipEditHistoryProps) {
  const { corrections, pendingCount } = state;
  if (corrections.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
        Edit history ({corrections.length})
        {pendingCount > 0 ? (
          <Badge variant="outline" className="ml-1 h-5 gap-1 text-warning">
            {pendingCount} not resent
          </Badge>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 space-y-2 border-l border-border pl-3">
          {corrections.map((c) => (
            <CorrectionEntry key={c.id} correction={c} currency={currency} />
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CorrectionEntry({
  correction: c,
  currency,
}: {
  correction: PayslipCorrection;
  currency: string | null;
}) {
  const isMoney = c.field === "base_pay";
  const show = (v: number) =>
    isMoney ? formatMoney(v, currency) : `${v} hour${v === 1 ? "" : "s"}`;
  const pending = c.appliedDeliveryId === null;

  return (
    <li className="space-y-0.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-foreground">
          {isMoney ? "Base pay" : "Overtime hours"}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {show(c.oldValue)} → <span className="text-foreground">{show(c.newValue)}</span>
        </span>
        <Badge variant="outline" className={cn("h-5", pending ? "text-warning" : "text-success")}>
          {pending ? "not resent" : "resent"}
        </Badge>
      </div>
      <p className="text-muted-foreground">{c.reason}</p>
      <p className="text-muted-foreground/80">
        {c.editedByName ?? "Unknown user"} · {new Date(c.editedAt).toLocaleString()}
      </p>
    </li>
  );
}

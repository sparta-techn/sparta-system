/**
 * "Send reward" form + preview.
 *
 * Amount (numeric, currency prefilled from the org default), an optional
 * reason, and a live preview of the EXACT email the employee will receive —
 * the preview calls the same `renderRewardEmail` the server sends with, so the
 * two cannot drift.
 *
 * Submit is two steps, mirroring how the row records its own outcome:
 *   1. create the reward (`pending`) through the repository (RLS: owner/admin),
 *   2. invoke the `sendRewardFn` server RPC, which emails the employee and
 *      stamps `sent` / `failed` (+ the captured error) on the row.
 * A failed send therefore still leaves a visible `failed` row in the history —
 * the error is surfaced in the toast AND kept on the record.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { hrQueries } from "@/features/hr/queries";
import type { HrEmployee } from "@/features/hr/mock-data";
import { rewardRepository } from "@/repositories/hr";

import { renderRewardEmail } from "../reward-email";
import { sendRewardFn } from "../rewards.functions";
import { rewardCompanyQuery, rewardKeys } from "../queries";

interface SendRewardDialogProps {
  employee: HrEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendRewardDialog({ employee, open, onOpenChange }: SendRewardDialogProps) {
  const queryClient = useQueryClient();
  const defaultCurrencyQuery = useQuery(hrQueries.defaultCurrency());
  const companyQuery = useQuery(rewardCompanyQuery());

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [reason, setReason] = useState("");

  // Fresh form per employee; currency re-seeds from the org default.
  useEffect(() => {
    if (open) {
      setAmount("");
      setReason("");
      setCurrency(defaultCurrencyQuery.data ?? "EGP");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const currencyValid = /^[A-Za-z]{3}$/.test(currency.trim());

  // The exact email the employee will get — same renderer the server uses.
  const preview = useMemo(() => {
    if (!employee) return null;
    const company = companyQuery.data;
    return renderRewardEmail({
      employeeName: employee.name,
      amount: amountValid ? parsedAmount : 0,
      currency: currencyValid ? currency.trim().toUpperCase() : "EGP",
      reason,
      company: {
        name: company?.name ?? "SpartaFlow",
        logoUrl: company?.logo_url ?? null,
        supportEmail: company?.support_email ?? null,
      },
      sentAtLabel: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    });
  }, [employee, amountValid, parsedAmount, currency, currencyValid, reason, companyQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Durable record first (status 'pending')…
      const reward = await rewardRepository.createReward(
        employee!.id,
        parsedAmount,
        currency.trim().toUpperCase(),
        reason,
      );
      // 2. …then the send, which stamps 'sent' or 'failed' on that row.
      return sendRewardFn({ data: { rewardId: reward.id } });
    },
    onSuccess: (result) => {
      toast.success(`Reward sent to ${result.recipientEmail}.`);
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
      onOpenChange(false);
    },
    onError: (error) => {
      // The failed row (with this error) is already in the history tab.
      toast.error(getErrorMessage(error));
      void queryClient.invalidateQueries({ queryKey: rewardKeys.all });
    },
  });

  if (!employee) return null;

  const canSend = amountValid && currencyValid && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send reward</DialogTitle>
          <DialogDescription>
            {employee.name} · {employee.email}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="reward-amount">Amount</Label>
                <Input
                  id="reward-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="w-20 space-y-1.5">
                <Label htmlFor="reward-currency">Currency</Label>
                <Input
                  id="reward-currency"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reward-reason">
                Reason <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="reward-reason"
                rows={5}
                placeholder="e.g. Outstanding delivery of the Q3 release"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Included in the email in the language you write it — Arabic or English.
              </p>
            </div>
          </div>

          {/* Live preview of the exact bilingual email (isolated from app CSS). */}
          <div className="space-y-1.5">
            <Label>Email preview</Label>
            <div className="h-72 overflow-hidden rounded-lg border border-border bg-muted/40">
              {preview ? (
                <iframe
                  title="Reward email preview"
                  sandbox=""
                  srcDoc={preview.html}
                  className="h-full w-full"
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Sent bilingually (العربية + English) to {employee.email}.
            </p>
          </div>
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
            Send reward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

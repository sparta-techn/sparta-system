# Payslip emails — "Mark as paid & send"

How an employee finds out they've been paid. Manual by design: the system never
claims money moved until a human confirms it did.

---

## 1. The rule

**Nothing sends automatically.** Not on a schedule, not on a trigger, not when
the `.xlsx` is exported. A payslip email leaves the building only when someone
with Owner / Admin / HR clicks the per-employee action on
`/app/payroll` and affirms the bank transfer completed.

The export answers *"what do we owe?"*. The payslip answers *"what did we
actually pay you?"* — and only the second one is allowed to reach an employee.

---

## 2. Flow

```
Payroll page (Owner/Admin/HR)
  │  per-employee "Mark paid & send"  ← one deliberate click, no bulk verb
  ▼
MarkPaidDialog                       ← shows the figures + requires an affirmation
  │  sendPayslipFn  (server fn, requireSupabaseAuth)
  ▼
authorize()                          ← re-checks owner/admin/hr against user_roles
  │
  ▼
payslip.server.ts  sendPayslip()
  ├── payroll_report(_from,_to) ──── the SAME RPC the .xlsx export reads
  ├── guard: pay rate configured? total > 0? already paid?
  ├── renderPayslipEmail()           ← pure template
  ├── ensureSenderVerified() ─────── pre-flight: is the domain actually verified?
  ├── EmailClient.send()  ────────── Resend API (idempotency key per attempt)
  └── INSERT payslip_deliveries      ← paid_at, figures snapshot, message id
                                       + auditLog "payroll.payslip_sent"
```

---

## 3. One calculation, never two

`sendPayslip` calls `payroll_report(_from, _to)` — byte-identical to what
`getPayrollReport` feeds the spreadsheet — and picks the one row for that
employee. The template does no arithmetic: it prints `base_pay`,
`overtime_pay` and `total_pay` as the report returned them.

There is deliberately **no second pay calculation anywhere in this feature.** If
the email and the sheet ever disagree, that is a bug in `payroll_report`, not a
drift between two implementations. A regression test pins this: a line whose
`total_pay` deliberately ≠ `base_pay + overtime_pay` must still render the
report's own total.

---

## 4. What the email shows

| Section          | Source field(s)                                        |
| ---------------- | ------------------------------------------------------ |
| Pay period       | caller's `periodLabel` (e.g. "July 2026")              |
| Base pay         | `base_pay`                                             |
| Overtime         | `overtime_hours` + `overtime_pay` — **approved only**, always a separate line |
| Total paid       | `total_pay`                                            |
| Paid exceptions  | `paid_exception_count` / `paid_exception_hours`        |
| Unpaid exceptions| `unpaid_exception_count` / `unpaid_exception_hours`    |
| Unpaid absences  | `absence_days`                                         |
| Pending overtime | `overtime_pending_count` — flagged as *excluded*       |

Unpaid items are shown whenever non-zero, in warning colour. An employee should
learn about a deduction from their payslip, not by noticing the total is short.
The overtime line is omitted entirely when there is none, rather than printing a
zero.

Styling is derived from the app's design tokens in `src/styles.css`, converted
oklch → hex (email clients don't support oklch) and inlined on every element.

---

## 5. Not sending twice

Three independent layers:

1. **`payslip_deliveries`** records every send. The payroll table shows
   "Paid 31 Jul" for anyone already sent this period.
2. **Explicit resend confirmation.** `sendPayslip` refuses a second send unless
   `confirmResend` is set; the dialog only sets it after a *separate* checkbox
   is ticked, on top of the transfer affirmation.
3. **Resend idempotency key** — `payslip:{employee}:{from}:{to}:{attempt}`. Send
   happens *before* the DB insert, so if the insert fails and the sender retries,
   the same attempt number is recomputed and Resend returns the original message
   id instead of mailing a second payslip. The error message says so explicitly.

A resend appends a new row (`attempt` 2, 3, …) rather than overwriting, so the
first-notified date survives.

`payslip_deliveries` has **no INSERT policy for `authenticated`** — only the
service-role server function writes it. A client cannot forge, backdate or
delete a payment record.

---

## 6. Refusals

`sendPayslip` will not send when:

| Condition                     | Why                                                    |
| ----------------------------- | ------------------------------------------------------ |
| No `payroll_report` row       | Employee isn't in the period.                          |
| `has_pay_data = false`        | No rate configured — the figures would all be zero.    |
| `total_pay <= 0`              | Nothing to confirm as paid.                            |
| No email on the profile       | Nowhere to send it.                                    |
| Already paid, no confirmation | Needs the explicit resend affirmation.                 |
| `RESEND_API_KEY` unset        | Says so plainly instead of failing obscurely.          |
| Sender domain unverified      | Resend would accept it and then not deliver — see §7.1.|

The first three are also reflected in the table: the action is replaced by a
disabled `—` with a tooltip.

---

## 7. Transport

`EmailClient` (`src/integrations/email/email-client.ts`) posts to Resend's
`/emails` API. **Not** Supabase Auth's SMTP — GoTrue only sends its own invite /
signup / recovery templates and cannot carry arbitrary mail.

The API key is read in exactly one place, `resend.server.ts`, which is reached
only through `await import(...)` from a server handler. `EmailClient` itself
takes the key via config and never touches `process.env`, so it stays safe to
import from isomorphic code. Verified by grepping the built client bundle.

Sender defaults to `Sparta Flow HR <hr@spartaflow.com>`; override with
`PAYROLL_EMAIL_FROM`. Resend authorizes per **domain**, so any address on the
already-verified `spartaflow.com` needs no extra setup.

### 7.1 Sender pre-flight

`ensureSenderVerified()` runs immediately before every send, because Resend
**accepts** a send from an unverified domain and only *then* fails delivery.
Without the check, a payslip would be recorded as sent — with a real message id
— and never arrive, and `payslip_deliveries` would suppress the retry.

| Probe result                              | Behaviour       |
| ----------------------------------------- | --------------- |
| Domain verified                           | send            |
| Domain known but `pending` / `failed`     | **block**       |
| Domain not in the Resend account at all   | **block**       |
| No key or no sender configured            | **block**       |
| `/domains` returns 401/403 (send-only key)| send + `warn` log |
| Network error / rate-limited              | send + `warn` log |

It fails **closed** on a definitive "no" and **open** on an inconclusive probe.
Resend supports sending-only API keys that cannot read `/domains`; blocking
payroll because a valid key lacks a *read* scope would be worse than the problem
being solved. When the probe is inconclusive the send proceeds and, if the key
is genuinely bad, the send itself fails a moment later with the same error. The
skip is logged via `appLog.warn`, never silent.

Both blocking messages state explicitly that **nothing was sent and no payment
was recorded**, so the operator knows the retry is safe.

A successful verification is memoized for 15 minutes (a verified domain doesn't
spontaneously unverify). A *pending* domain is deliberately not cached, so it
flips to sendable the moment DNS lands — no restart needed.

---

## 8. Access

`payroll.manage`-equivalent: Owner / Admin / HR, matching the payroll page's own
restriction. Enforced in three places — the route guard (UX), `authorize()` in
the server function against real `user_roles` grants (the real gate), and RLS on
`payslip_deliveries` (the backstop).

---

## 9. Files

| Concern              | File                                                    |
| -------------------- | ------------------------------------------------------- |
| Schema + RLS         | `supabase/migrations/20260731120000_payslip_deliveries.sql` |
| Template (pure)      | `src/features/payroll/payslip-email.ts`                 |
| Template tests       | `src/features/payroll/payslip-email.test.ts`            |
| Orchestrator         | `src/features/payroll/payslip.server.ts`                |
| Server RPCs          | `src/features/payroll/payslip.functions.ts`             |
| Confirmation dialog  | `src/features/payroll/components/mark-paid-dialog.tsx`  |
| Table action         | `src/features/payroll/components/payroll-export-panel.tsx` |
| Transport            | `src/integrations/email/email-client.ts`                |
| Credential (server)  | `src/integrations/email/resend.server.ts`               |

# Leave Management

## Leave types
`annual`, `sick`, `emergency`, `unpaid`, `remote_exception`, `parental` (covers maternity / paternity).

## Surfaces
- **Balance totals** (top of `/app/hr/leave`) — remaining days across the company per type.
- **Requests tab** — table with status filter chips. Approve / Reject inline on pending rows.
- **Calendar tab** — 7-day strip showing who is out, coloured by leave type.
- **Balances tab** — per-employee balance ledger (used / total).

## Request lifecycle
```text
draft ──submit──▶ pending ──approve──▶ approved
                       └──reject──▶ rejected
                       └──cancel──▶ cancelled
```

Mock data renders examples in each state. `LeaveStatusBadge` and `LeaveTypeBadge` are the canonical visual encoding.

## Balance shape
```ts
interface HrLeaveBalance {
  employeeId: string;
  annual:    { used: number; total: number };
  sick:      { used: number; total: number };
  emergency: { used: number; total: number };
  parental:  { used: number; total: number };
}
```
Unpaid and remote-exception leave do not accrue; they are tracked as request-only.

## Manager / employee surfaces
- Employees raise requests from their own profile (placeholder today — wires through the same `leaveRequests` collection).
- Managers see only requests for their direct reports; HR sees all. Enforced via RLS once backend is wired.
- Approver identity persisted in `HrLeaveRequest.approverId`.

## Non-goals
- Payroll integration — handled by Finance system later.
- Government / statutory reporting — out of scope.

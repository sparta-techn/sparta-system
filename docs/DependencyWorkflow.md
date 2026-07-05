# Dependency Workflow

```
Employee identifies blocker
        │
        ▼
   Create Dependency  ── (Draft optional) ──► saved, not visible to owner
        │
        ▼  state: Pending
   Assign owner / department
        │
        ▼  notification (future)
   Owner reviews
   ├─► Accept   → state: Accepted
   ├─► Reject   → state: Rejected (terminal)
   └─► Cancel   → state: Cancelled (requester-initiated, terminal)
        │
        ▼
   Owner starts work → state: In Progress
        │
        ├─► Hits external blocker → state: Blocked
        │        │
        │        └─► Unblocked → state: In Progress
        │
        ▼
   Owner marks Resolved
        │
        ▼
   Requester confirms → state: Closed
```

## Roles in the flow

- **Requester** — creates the dependency, confirms resolution, can cancel.
- **Owner** — accepts, works, marks resolved, can mark blocked.
- **Manager** — views aggregates, can reassign owner or escalate priority.

## State transitions allowed

| From → To | Who |
|---|---|
| Draft → Pending | Requester |
| Pending → Accepted / Rejected | Owner |
| Pending → Cancelled | Requester |
| Accepted → In Progress / Blocked | Owner |
| In Progress ↔ Blocked | Owner |
| In Progress / Blocked → Resolved | Owner |
| Resolved → Closed | Requester (or auto after grace period — future) |
| Resolved → In Progress | Requester (re-open if unsatisfied) |

The current UI exposes all states through the Status select for flexibility; production enforcement will live server-side as a state-machine RPC mirroring this table.

## Timeline events emitted

| Event | Triggered by |
|---|---|
| `created` | New dependency |
| `assigned` | Owner set or changed |
| `accepted` | Owner accepts |
| `status_changed` | Any state move except terminal-specific ones below |
| `priority_changed` | Priority edit |
| `comment_added` | New comment |
| `resolved` | Move to Resolved |
| `closed` | Move to Closed |
| `rejected` | Move to Rejected |
| `cancelled` | Move to Cancelled |

## Notification triggers (future)

- Dependency assigned → owner.
- Mentioned in comment → mentioned users.
- Status updated → requester + watchers.
- Dependency resolved → requester.
- Dependency overdue (`dueAt < now` and open) → requester + owner + their manager.

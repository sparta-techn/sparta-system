# Dependency States

Canonical state vocabulary. Tone tokens are design-system semantic colors.

| State | Tone | When it applies | Open? |
|---|---|---|---|
| `draft` | neutral | Saved by requester but not submitted | No (private) |
| `pending` | warning | Submitted, awaiting owner action | Yes |
| `accepted` | info | Owner acknowledged, not started yet | Yes |
| `in_progress` | primary | Owner actively working | Yes |
| `blocked` | danger | Owner is themselves blocked | Yes |
| `resolved` | success | Owner marked done, awaiting requester confirmation | Yes (until closed) |
| `rejected` | danger | Owner declined (with reason in comment) | No (terminal) |
| `cancelled` | neutral | Requester withdrew the ask | No (terminal) |
| `closed` | neutral | Requester confirmed resolution | No (terminal) |

## Priority

| Priority | Tone | Guidance |
|---|---|---|
| `low` | neutral | Nice-to-have, no deadline pressure |
| `medium` | info | Standard ask, within a few days |
| `high` | warning | Blocking work, needed this sprint |
| `critical` | danger | Production / launch blocker, same day |

## Types

Backend API · UI Design · Frontend · QA · DevOps · Database · Content · Product Decision · Client Feedback · Bug Fix · Infrastructure · Security · Other.

Choose the type closest to the work the owner has to do, not the work the requester is unblocking. This keeps department-level analytics meaningful (e.g. "Backend is currently the bottleneck for 40% of open asks").

## Kanban mapping

Only the actionable lifecycle states surface as columns:

`Pending → Accepted → In Progress → Blocked → Resolved → Closed`

`Draft`, `Rejected`, and `Cancelled` are intentionally absent — they're either private or terminal failures and are accessed via filters / detail page.

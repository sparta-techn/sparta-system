# Automation Engine

Turns domain events into notifications using declarative rules.

## Rule shape

```ts
interface AutomationRule {
  id: string;
  description: string;
  on: EventName[];                          // events this rule reacts to
  when?: (event) => boolean;                // optional predicate
  build: (event) => NotificationSpec[];     // 0..n specs per event
}
```

## NotificationSpec → AppNotification

Each spec declares the audience, content, priority, channels and
optional deep-link. The engine:

1. Filters rules whose `on` matches the event name.
2. Calls `build(event)` → `NotificationSpec[]`.
3. Resolves each spec's `recipients: RecipientRule[]` to concrete user
   ids via `resolveRecipients` (`employee` · `manager` · `hr` · `owner`
   · `department` · `role` · `user`).
4. Consults `preferences` for the recipient's category and quiet hours.
5. Persists one `AppNotification` per recipient via `notificationStore`.
6. Asks the channel registry to deliver — only in-app is wired today;
   future channels are no-ops until their integration ships.

## Built-in rules

| Rule | Trigger | Recipients |
| --- | --- | --- |
| `att.late.notify-self` | `attendance.late` | employee |
| `att.absent.notify-manager` | `attendance.absent` | manager |
| `att.checked_in.welcome` | `attendance.checked_in` | employee |
| `checkin.missing.reminder` | `checkin.missing` | employee |
| `midday.missing.reminder` | `midday.missing` | employee |
| `eod.missing.reminder` | `eod.missing` | employee |
| `dep.assigned.owner` | `dependency.assigned` | owner |
| `dep.mentioned` | `dependency.mentioned` | each mentioned user |
| `dep.overdue.escalate` | `dependency.overdue` | owner + manager + requester |
| `dep.resolved.requester` | `dependency.resolved` | requester |
| `dep.comment.owner` | `dependency.comment_added` | owner + requester (excl. actor) |
| `announcement.published.everyone` | `announcement.published` | employees + managers |
| `user.invited` / `user.role_changed` | account events | the target user |

## Time-based rules (mock scheduling)

The architecture supports scheduled triggers (09:30 late notice → 10:00
manager escalation → 14:00 midday reminder → 17:30 EOD reminder). In
this build the timing is owned by each module's existing reminder hook
(`useAttendanceReminders`, midday reminder, EOD store), which can call
`eventBus.publish` instead of toasting directly. On the backend these
become `pg_cron` jobs that publish the same events; the rule table does
not change.

## Adding a rule

```ts
import { automationEngine } from "@/features/notifications/automation-engine";

automationEngine.registerRule({
  id: "dep.created.notify-pmo",
  description: "Notify PMO when a high-priority dependency is created",
  on: ["dependency.created"],
  when: (e) => e.payload.priority === "high",
  build: (e) => [
    {
      recipients: [{ kind: "department", department: "PMO" }],
      category: "dependencies",
      type: "info",
      priority: "high",
      title: "New high-priority dependency",
      body: e.payload.title as string,
      href: `/app/dependencies/${e.subjectId}`,
    },
  ],
});
```

No business module is touched.

## Error handling

Rule `build` and channel `deliver` failures are caught individually so
one broken rule never breaks the rest of the pipeline. Errors are
logged via `console.error` with the rule/channel id for diagnosis.

# Event Architecture

Every meaningful action in SpartaFlow Hub is modelled as a `DomainEvent`
published to an in-process bus. Business modules **never** import the
notification store or call delivery code directly.

```
Business Module ──► eventBus.publish(...)
                         │
                         ▼
                automationEngine.handle(event)
                         │
                ┌────────┴────────┐
                ▼                 ▼
        notificationStore     channels.deliver(...)
                                  │
                                  ▼
                          recipient device/app
```

## DomainEvent shape

```ts
{
  id: string,            // evt_xxx
  name: EventName,       // "dependency.assigned"
  category: EventCategory,
  actorId: string | "system",
  subjectId?: string,    // user id, dep id, announcement id…
  payload: Record<string, unknown>,
  occurredAt: ISO string,
}
```

## Event catalogue

| Category     | Events                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Attendance   | `attendance.checked_in` · `checked_out` · `break_started` · `break_ended` · `late` · `absent`                                    |
| Check-in     | `checkin.submitted` · `edited` · `missing`                                                                                       |
| Midday       | `midday.submitted` · `updated` · `missing`                                                                                       |
| EOD          | `eod.submitted` · `updated` · `missing`                                                                                          |
| Dependency   | `dependency.created` · `assigned` · `accepted` · `rejected` · `blocked` · `resolved` · `comment_added` · `mentioned` · `overdue` |
| Announcement | `announcement.published` · `scheduled` · `updated` · `expired`                                                                   |
| User         | `user.invited` · `activated` · `disabled` · `password_reset` · `role_changed`                                                    |

## Publishing

```ts
import { eventBus } from "@/features/notifications/event-bus";

eventBus.publish({
  name: "dependency.assigned",
  actorId: currentUserId,
  subjectId: dep.id,
  payload: { ownerId: dep.ownerId, title: dep.title },
});
```

The publisher is fully decoupled from the consumer. Adding a new
subscriber (audit log, analytics, integration) is `eventBus.subscribe(fn)`.

## Why a bus?

- **Loose coupling** — UI features know nothing about delivery channels.
- **Replayable** — the bus retains the last 200 events for debug.
- **Composable** — multiple subscribers can react to the same event
  (automation engine, audit log, analytics).
- **Swap-friendly** — the in-memory bus mirrors what a backend topic
  (Postgres `LISTEN/NOTIFY`, Supabase Realtime, Kafka) will do later;
  replacing it doesn't change publishers.

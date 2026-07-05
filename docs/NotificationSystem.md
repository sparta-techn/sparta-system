# Notification System

In-app notification and inbox layer for SpartaFlow Hub. Decoupled from
business logic: domain modules emit events on the bus, the automation
engine decides what to deliver, and the channel registry delivers it.

## Modules

| File | Responsibility |
| --- | --- |
| `types.ts` | Event, notification, recipient, rule, preference contracts |
| `event-bus.ts` | Synchronous pub/sub (`eventBus.publish`, `eventBus.subscribe`) |
| `directory.ts` | Resolve `RecipientRule[]` to user ids (mock people, roles, departments) |
| `channels.ts` | Channel registry. In-app is live; email/Slack/etc. registered as disabled |
| `rules.ts` | Default automation rules |
| `automation-engine.ts` | Subscribes to bus, runs rules, writes to store, calls channels |
| `store.ts` | Notification persistence (localStorage). `useNotifications`, `useUnreadCount` |
| `preferences.ts` | Category / channel / quiet-hours user prefs |
| `bootstrap.ts` | `useNotificationBootstrap` — wires engine + seed on first mount |
| `mock-data.ts` | Realistic seed + `fireDemoEvent` for the preferences page |
| `ui.ts` | Icon + tone + bucket helpers |
| `components/notification-dropdown.tsx` | Topbar popover + reusable row |
| `components/notification-center.tsx` | Full `/app/notifications` page |
| `components/notification-preferences.tsx` | `/app/notifications/preferences` page |
| `components/notification-widgets.tsx` | Dashboard widgets (employee + manager) |

## Routes

- `/app/notifications` — center with search, filters, tabs (All / Unread / Archived), buckets (Today / Yesterday / Earlier)
- `/app/notifications/preferences` — categories, channels, quiet hours, demo buttons
- Topbar bell — popover dropdown with grouped recent + "Mark all read"

## Notification model

```
AppNotification {
  id, eventId, eventName, category, type, priority,
  title, body, recipientId, channels,
  actions?, href?, createdAt, readAt?, archivedAt?, deletedAt?, expiresAt?, meta?
}
```

Lifecycle: `created → delivered → read → archived → deleted` (+ `expired`
when `expiresAt` passes; computed in `notificationStore.lifecycleOf`).

## Backend swap

Every UI hook reads from `notificationStore`; every business module talks
to `eventBus`. To go live:

1. Replace `notificationStore` internals with Supabase queries +
   Realtime subscriptions — the React surface is unchanged.
2. Replace `eventBus.publish` with an RPC that writes to an `events`
   table; have the automation engine run server-side (Edge fn or
   scheduled).
3. Implement future channels (email, Slack, …) as `NotificationChannel`
   in `channels.ts`. No business code changes.

# Notification Preferences

Per-user preferences stored at `sf:notifications:prefs:v1` (localStorage
mock; backend swap = `user_notification_preferences` table).

## Categories

| Key             | UI label      | What it gates                                  |
| --------------- | ------------- | ---------------------------------------------- |
| `attendance`    | Attendance    | Check-in / break / late / absent notifications |
| `dependencies`  | Dependencies  | Assignments, blockers, comments, resolutions   |
| `announcements` | Announcements | Company / team announcements                   |
| `reports`       | Reports       | Morning, midday, EOD reminders                 |
| `mentions`      | Mentions      | `@you` in any comment thread                   |
| `system`        | System        | Account, security and platform updates         |

A `false` category means the engine drops matching specs before they
reach `notificationStore`. The event is still on the bus — other
subscribers (audit log) are unaffected.

## Channels

In-app is the only enabled channel today. Email, Slack, Teams,
Telegram, WhatsApp, Push and SMS are registered as disabled stubs so
the preferences UI can list them and the architecture can evolve
without API breaks.

## Quiet hours

When enabled, only notifications with `priority = critical` or
`type = critical` deliver between `start` and `end`. Computed with
`isInQuietHours(prefs)`; supports overnight ranges (e.g. 22:00 → 07:00).

## API

```ts
preferences.get();
preferences.setCategory("dependencies", false);
preferences.setChannel("email", true);
preferences.setQuietHours({ enabled: true, start: "22:00", end: "07:00" });
preferences.reset();
usePreferences(); // React hook
```

## UI

`/app/notifications/preferences` (link in sidebar → Notifications →
Preferences action and in the topbar dropdown). The page includes
**Try the engine** buttons that fire mock events through `eventBus` so
QA can verify routing + preference filtering live.

## Backend notes

When porting to Supabase:

- Persist preferences in `user_notification_preferences (user_id, key, value jsonb)`.
- Push prefs to the engine subscription on sign-in so server-side
  evaluation matches the client.
- Channel-level prefs map to integration tables (e.g. `slack_targets`)
  that the future channel implementations read.

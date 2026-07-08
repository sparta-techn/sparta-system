# Notification Integrations — Slack, Discord, Email, Google Calendar

Architecture for four **outbound notification channels**. SpartaFlow builds one
neutral notification — a daily report, a sprint update, a mention, an approval
request, a meeting reminder — and delivers it through whichever channels are
configured, via a single vendor-neutral capability port.

> **Status: architecture only — no external API is called yet.**
> Every network path terminates at a per-provider `notImplemented` client seam.
> Metadata + settings schemas are live (so all four render in the Admin list
> today); each stays `available: false` until its client is wired. Wiring one
> channel touches only that channel's client — no port, feature, or other adapter
> changes (Open/Closed).

These extend the platform in
[`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) /
[`src/integrations/README.md`](../src/integrations/README.md), following the same
two-layer shape as the GitHub and activity providers
([`docs/GITHUB.md`](./GITHUB.md), [`docs/ACTIVITY_INTEGRATIONS.md`](./ACTIVITY_INTEGRATIONS.md)):
the generic six-method `Integration` lifecycle **plus** a capability port.

---

## Supported notification kinds

The port models the six requested notification types as `NotificationKind`. Each
provider advertises which kinds it can deliver via `supportedKinds`, and returns a
`skipped` result (no network) for kinds or targets it can't route.

| Kind               | Meaning                          | Rendering hint                                         |
| ------------------ | -------------------------------- | ------------------------------------------------------ |
| `generic`          | Any one-off notification.        | Title + body.                                          |
| `daily_report`     | End-of-day report digest.        | Title + body, optional link to the report.             |
| `sprint_update`    | Sprint progress / status change. | Title + body, link to the sprint board.                |
| `mention`          | Someone was @mentioned.          | High priority; may @mention the recipient.             |
| `approval_request` | An action needs sign-off.        | Renders **action buttons** (Approve / Reject).         |
| `meeting_reminder` | Upcoming meeting.                | Renders `MeetingDetails` (start, join URL, attendees). |

---

## The shared capability port — `NotifierPort`

Declared once in `src/integrations/ports/notifier.ts` and implemented by all four
providers. Delivery is a capability port (Architecture doc §5) — the
channel-neutral generalization of the `ChatNotifierPort` sketched there — so the
`Integration` interface never widens.

```ts
export interface NotifierPort {
  readonly supportedKinds: readonly NotificationKind[];
  supports(kind: NotificationKind): boolean;
  notify(accountId: string, request: NotificationRequest): Promise<DeliveryResult>;
}
```

The neutral payload every provider maps onto:

```ts
interface Notification {
  kind: NotificationKind;
  title: string;
  body: string;
  priority?: "low" | "normal" | "high" | "urgent";
  link?: string;
  actions?: NotificationAction[]; // approval_request buttons
  meeting?: MeetingDetails; // meeting_reminder details
  data?: Record<string, unknown>;
}

type NotificationTarget = // where it goes — a tagged union
  | { type: "user"; ref: string }
  | { type: "channel"; ref: string }
  | { type: "email"; address: string }
  | { type: "calendar"; ref: string };

interface DeliveryResult {
  state: "delivered" | "queued" | "skipped" | "failed";
  kind: NotificationKind;
  target: NotificationTarget;
  externalId?: string; // provider message/event id
  detail?: string; // why skipped/failed
}
```

A feature builds one `Notification` and stays vendor-blind:

```ts
import { getIntegrationRegistry, isNotifierPort } from "@/integrations";

const provider = getIntegrationRegistry().get("slack");
if (isNotifierPort(provider) && provider.supports("approval_request")) {
  const result = await provider.notify(accountId, {
    target: { type: "channel", ref: "C123" },
    notification: {
      kind: "approval_request",
      title: "Leave request — Sara",
      body: "3 days, starting Mon.",
      actions: [
        { id: "approve", label: "Approve", style: "primary", url: "https://…/approve" },
        { id: "reject", label: "Reject", style: "danger", url: "https://…/reject" },
      ],
    },
    dedupeKey: "leave-4821",
  });
}
```

New capability tag: `"notify.send"` (added to `IntegrationCapability`). Fan-out to
every configured channel is a registry filter:

```ts
const channels = getIntegrationRegistry()
  .catalog()
  .filter((m) => m.available && m.capabilities.includes("notify.send"))
  .map((m) => getIntegrationRegistry().get(m.id))
  .filter(isNotifierPort);
```

---

## Per-provider folder shape

Each provider is a self-contained folder — the per-provider layout the
architecture targets (Slack graduated here out of the shared placeholder file):

```
src/integrations/<provider>/
  types.ts                          # vendor DTOs + client config
  <provider>-client.ts              # the ONE HTTP/SDK/transport seam (notImplemented)
  <provider>-notifier.service.ts    # NotifierPort impl + pure notification→vendor mapper
  <provider>-integration.ts         # adapter: BaseIntegration + NotifierPort
  index.ts                          # provider barrel
```

Data flow:

```
feature ─▶ NotifierPort ◀─implements─ <Provider>Integration
                                            │ delegates
                                            ▼
                                <Provider>NotifierService
                                            │ maps Notification → vendor payload
                                            ▼
                                   <Provider>Client ── notImplemented
                                   (single transport seam)
```

Lifecycle concerns are all **inherited** from `BaseIntegration` — Connection
(`connect`→`authenticate`), Validation (`validate`), Health Check
(`healthCheck`→`probe`), Settings (`settings`+`settingsSchema`), and the Sync
placeholder (`sync`→`performSync`, deliberately `notImplemented`). Only delivery
(`NotifierPort`) is provider-specific.

---

## The four channels

### Slack — `src/integrations/slack/`

- `category: "chat"`, `scope: "org"`, `auth: "oauth2"`,
  capabilities `["notify.send", "chat.notify", "webhook.inbound"]`, webhooks on.
- Delivers **all six kinds**; renders Block Kit (header + section, action buttons
  for approvals). Routes `user`/`channel` targets.
- Settings: `defaultChannel` (required), `mentionOnEscalation` (bool).

### Discord — `src/integrations/discord/`

- `category: "chat"`, `scope: "org"`, `auth: "api_token"` (bot token),
  capabilities `["notify.send", "chat.notify"]`.
- Delivers **all six kinds**; renders a rich embed (priority-colored) + link
  buttons. Routes `user`/`channel` targets.
- Settings: `defaultChannelId` (required), `mentionRoleId`.

### Email — `src/integrations/email/`

- `category: "other"`, `scope: "org"`, `auth: "api_token"` (SMTP/API),
  capabilities `["notify.send"]`. Transport-neutral (SMTP or SES/SendGrid/Postmark).
- Delivers **all six kinds**; renders HTML + text (subject = title; actions and
  links appended). Routes `email` targets only — resolve users to an address
  upstream.
- Settings: `fromAddress` (required), `fromName`, `replyTo`.

### Google Calendar — `src/integrations/google-calendar/`

- `category: "calendar"`, `scope: "user"`, `auth: "oauth2"`,
  capabilities `["notify.send", "calendar.sync", "webhook.inbound"]`, webhooks on.
- A **narrow** channel: `supportedKinds = ["meeting_reminder"]` only. A meeting
  reminder becomes a calendar event (`events.insert`) with reminder overrides;
  every other kind returns `skipped` **without any client call**. Routes
  `calendar`/`user` targets.
- Settings: `calendarId` (default `primary`), `reminderMinutes` (default 10).

---

## Boundaries the design keeps

- **One capability, four heterogeneous channels.** Chat, email and calendar all
  implement `NotifierPort`; a feature depends on the port, never on a vendor.
- **Graceful capability granularity.** `supportedKinds` + `skipped` results let a
  narrow channel (Calendar) coexist with full channels (Slack/Discord/Email)
  behind one interface — no per-kind branching in feature code.
- **One transport seam per provider.** Each `*-client.ts` is the only file that
  will touch the network — the single place to audit auth, retries, rate limits
  and idempotency (Architecture doc §9). `dedupeKey` threads through as the
  transport idempotency key.
- **Vendor payloads never leak.** Notifications map to Block Kit / embeds / MIME /
  event resources inside the service; features see only `Notification` /
  `DeliveryResult`.
- **Strict TypeScript, no `any`** — verified with `npx tsc --noEmit`.

---

## Wiring a real channel (the only future change)

1. Fill that provider's `*-client.ts` bodies: resolve the credential via
   `config.resolve*`, call the API/transport, map the response.
2. Implement the three placeholder vendor hooks in `*-integration.ts`
   (`authenticate`, `performSync`, `probe`).
3. Flip `available: true` in the provider's metadata.

The `NotifierPort`, the mappers, the registry, hooks and every other adapter stay
untouched.

---

## Related

- [`docs/GITHUB.md`](./GITHUB.md) — `VcsActivityPort` provider.
- [`docs/ACTIVITY_INTEGRATIONS.md`](./ACTIVITY_INTEGRATIONS.md) — `RecentActivityPort` providers.
- [`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) — full platform design.

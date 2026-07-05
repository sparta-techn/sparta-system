# Logging — Production Architecture

Reusable, isomorphic logging for SpartaFlow. One structured pipeline serves six
log streams and fans out to pluggable sinks. Console output is live everywhere;
**Sentry, Logtail, and OpenTelemetry adapters are prepared but inert** — no
external integration is wired yet, and activating one later is a one-liner.

- **Code**: `src/lib/logging/`
- **Entry point**: `import { appLog, errorLog, auditLog, authLog, activityLog, perfLog } from "@/lib/logging";`
- **Related specs**: [`AuditSystem.md`](./AuditSystem.md) (audit trail),
  [`ErrorHandling.md`](./ErrorHandling.md) / [`ERROR_HANDLING.md`](./ERROR_HANDLING.md)
  (error pipeline), [`SECURITY.md`](./SECURITY.md) (redaction rules).

---

## 1. Design goals

| Goal | How |
| --- | --- |
| **Reusable** | Six category services with fixed conventions — features never re-derive levels/shape. |
| **Isomorphic** | No React/Supabase/vendor imports in the core; safe in browser, SSR, and edge/worker runtimes. |
| **Structured** | Every log is a typed `LogRecord` (JSON in prod) — parseable by any shipper without an SDK. |
| **Safe** | Sensitive fields are redacted at emit time; a broken sink can never throw into the app. |
| **Swappable sinks** | Adapters are injected via `configureLogging`; vendors are prepared, not hard-wired. |
| **Correlatable** | A `correlationId` threads every stream (and DB audit rows — `AuditSystem.md` §7). |

---

## 2. Module map

```
src/lib/logging/
├─ index.ts          Barrel — import everything from "@/lib/logging"
├─ types.ts          LogLevel, LogCategory, LogRecord, LogAdapter, event shapes
├─ correlation.ts    correlation ids + ambient LogContext (runWithContext)
├─ redact.ts         redact() / maskEmail() — sensitive-field scrubbing  (+ test)
├─ logger.ts         Logger engine: build → redact → dispatch → isolate   (+ test)
├─ services.ts       appLog · errorLog · auditLog · authLog · activityLog · perfLog
├─ config.ts         env detection, default `logger`, configureLogging()
└─ adapters/
   ├─ console.ts     ConsoleAdapter (pretty dev / NDJSON prod) + NoopAdapter   [LIVE]
   ├─ sentry.ts      SentryAdapter + toSentryEvent()                       [PREPARED]
   ├─ logtail.ts     LogtailAdapter + toLogtailPayload()                   [PREPARED]
   └─ otel.ts        OtelAdapter + toOtelLogRecord()                       [PREPARED]
```

---

## 3. The six log streams

| Stream | Service | Level(s) | Use for |
| --- | --- | --- | --- |
| **Application** | `appLog` | trace–error | Diagnostics, state transitions, feature flow. |
| **Error** | `errorLog` | error / fatal | Captured exceptions (serialized + redacted). |
| **Audit** | `auditLog` | info | Immutable trail of sensitive actions (role grants, overrides…). |
| **Authentication** | `authLog` | info / warn | Sign-in/out, failures, session expiry (emails masked). |
| **Activity** | `activityLog` | info | User-visible activity stream (bridges to `activity_feed`). |
| **Performance** | `perfLog` | info | Timings, spans, web vitals. |

All six share one engine, so level filtering, redaction, context, and sink
routing behave identically across streams.

---

## 4. Log levels

`trace < debug < info < warn < error < fatal` (weights 10–60).

- Global level: `debug` in dev/test, `info` in prod. Override with
  `VITE_LOG_LEVEL` / `LOG_LEVEL`, or `configureLogging({ level })`.
- Each adapter may set its own `minLevel` (e.g. Sentry defaults to `warn` — it's
  for problems, not chatter).

---

## 5. Usage

```ts
import { appLog, errorLog, auditLog, authLog, activityLog, perfLog } from "@/lib/logging";

// Application
appLog.info("check-in started", { userId, mode: "remote" });
appLog.child({ feature: "attendance" }).debug("reminder scheduled");

// Error (serialized + redacted automatically)
try { … } catch (err) { errorLog.capture(err, { context: { feature: "eod" } }); }
errorLog.fatal(err); // render crash / boot failure

// Audit — returns a redacted record ready to persist to audit_logs (server)
const rec = auditLog.record(
  { action: "role.grant", targetTable: "user_roles", targetId, before, after },
  { userId: actorId, actorRole: "owner", correlationId },
);

// Authentication (emails masked to j***@e***.com; failures logged at warn)
authLog.signIn(true, { method: "password", email });
authLog.signIn(false, { method: "password", reason: "invalid_credentials" });
authLog.sessionExpired();

// Activity (also bridges to the activity feed without importing the service)
activityLog.record({ sourceType: "task", sourceId, kind: "task.completed", summary });
await activityFeedService.log(activityLog.toFeedInsert(event));

// Performance
const end = perfLog.start("route.tasks.load");
// …
end({ rows: 240 });
await perfLog.measure("report.generate", () => generateReport());
```

---

## 6. Redaction (privacy by default)

`redact()` runs on every structured payload and on audit `before`/`after`
snapshots before a record leaves the process. It masks keys matching
password / secret / token / api-key / authorization / cookie / session /
credential / ssn / **salary** / card / cvv / pin / otp (case-insensitive), is
depth- and cycle-safe, and normalizes `Date`/`Error`. Emails go through
`maskEmail()`. This satisfies `AuditSystem.md` §9 and `SECURITY.md` and means
call sites don't have to remember to sanitize. Add project-specific keys with
`redact(value, { extraKeys: [/…/i] })`.

---

## 7. Correlation & context

- `LogContext` carries `correlationId`, `userId`, `actorRole`, `sessionId`,
  `route`, `feature`, `environment`, `release`, `runtime`.
- `newCorrelationId()` mints an id; `ensureCorrelationId()` reuses the ambient
  one; `runWithContext(ctx, fn)` scopes context to a request/gesture and
  restores it afterward.
- The default logger stamps ambient context onto every record. Bind stable
  fields once with `logger.child({ feature })` or `configureLogging({ context })`.
- Server request middleware should set `correlationId` and pass it to
  `set_config('request.correlation_id')` so logs, traces, and DB audit rows
  share one id end-to-end.

---

## 8. Adapters

An adapter is any `{ name, minLevel?, handle(record), flush?, close? }`. The
logger isolates `handle` failures, so a sink can never break the app.

| Adapter | Status | Notes |
| --- | --- | --- |
| `ConsoleAdapter` | **Live** | Pretty text in dev; **NDJSON** in prod (`structured: true`) — a legitimate prod transport that any shipper can tail/parse. |
| `NoopAdapter` | Live | Drops everything. |
| `SentryAdapter` | Prepared / inert | Forwards to an injected `SentryClient`; **no `@sentry/*` dep, no DSN**. Inert with no client. |
| `LogtailAdapter` | Prepared / inert | Batches `LogtailPayload`s; flushes via an injected `transport`. Buffers (bounded) with none. |
| `OtelAdapter` | Prepared / inert | Maps to the OTel Logs Data Model; forwards to an injected `emit` bridge. Inert with none. |

Each prepared adapter ships a **pure mapping function** (`toSentryEvent`,
`toLogtailPayload`, `toOtelLogRecord`) that is unit-tested today, so wiring the
real SDK later is trivial and low-risk.

---

## 9. Wiring an external sink later (when approved)

No code here needs to change — only bootstrap. Example (Sentry):

```ts
// 1. npm i @sentry/browser
// 2. app entry (client and/or server):
import * as Sentry from "@sentry/browser";
import { configureLogging, defaultAdapters, SentryAdapter } from "@/lib/logging";

Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
configureLogging({
  adapters: [...defaultAdapters(), new SentryAdapter(Sentry)],
  context: { release: import.meta.env.VITE_RELEASE },
});
```

Logtail: `new LogtailAdapter({ transport: (batch) => fetch(INGEST_URL, { method: "POST", headers, body: JSON.stringify(batch) }) })`.
OTel: stand up a `LoggerProvider` + OTLP exporter, then `new OtelAdapter({ emit: (r) => otelLogger.emit(r) })`.

Call `configureLogging` once per runtime at bootstrap; it's idempotent.

---

## 10. Integration with error handling

`@/lib/errors` `reportError()` — the funnel for global query/mutation `onError`
handlers and React error boundaries (see `ERROR_HANDLING.md`) — now fans out to
**`errorLog.capture()`** (structured logging) *and* the Lovable in-editor
transport. So every reported error already flows through this pipeline: today it
lands in the console as structured JSON; once a sink is wired it lands in
Sentry/Logtail/OTel too — no call-site changes.

---

## 11. What is NOT included (by design / future)

- **No external integration**: Sentry/Logtail/OTel SDKs are not installed and no
  DSN/token/exporter is configured. Adapters are inert until wired (§9).
- **Persistence of audit/activity rows** stays in the service/DB layer
  (`audit_logs` via triggers/SECURITY DEFINER — `AuditSystem.md`;
  `activity_feed` via `ActivityFeedService`). `auditLog`/`activityLog` produce
  the redacted, correctly-shaped records for that layer but don't write to the
  DB themselves — keeping the logging lib dependency-free.
- **Server request-scoped context** (`AsyncLocalStorage`) is intentionally not
  used to preserve isomorphism; `runWithContext` covers synchronous scoping.
  Revisit if deep async server pipelines need automatic propagation.
- **Migrating existing `console.*` calls** (18 sites) to `appLog`/`errorLog` is
  a follow-up; they keep working in the meantime.

---

## 12. Testing

`src/lib/logging/redact.test.ts` and `logger.test.ts` cover redaction
(sensitive keys, cycles, depth, email masking), level filtering (global +
per-adapter), context merging, sink isolation, error serialization, and the
three vendor mappings — **21 tests**, part of the suite (`npx vitest run`).

---

_Last updated: 2026-07-02._

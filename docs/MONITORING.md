# SpartaFlow — Monitoring Architecture

> How SpartaFlow is observed in production: health, metrics, error tracking, and
> audit — built as **provider-agnostic, isomorphic** subsystems with **inert
> vendor adapters** (the same ports-&-adapters discipline as the rest of the
> platform). Nothing here hard-depends on Sentry, Prometheus, or Grafana; each is
> a seam you activate at wiring time.
>
> Code: [`src/lib/monitoring/`](../src/lib/monitoring/) (metrics + health) and
> [`src/lib/logging/`](../src/lib/logging/) (errors + audit + spans).
> Related: [`docs/LOGGING.md`](./LOGGING.md), [`docs/AUDIT_LOGS.md`](./AUDIT_LOGS.md),
> [`docs/NGINX.md`](./NGINX.md), [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md).

---

## 1. The five pillars

| Pillar                  | Where it lives                                                         | Status                                        |
| ----------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| **Health endpoint**     | `src/lib/monitoring/health.ts` (+ Nginx `/healthz`)                    | Implemented                                   |
| **Application metrics** | `src/lib/monitoring/metrics.ts` + `registry.ts`                        | Implemented (in-memory + Prometheus render)   |
| **Performance metrics** | `metrics` histograms + `perfLog` (`src/lib/logging`)                   | Implemented                                   |
| **Error tracking**      | `errorLog` + `SentryAdapter` (`src/lib/logging`)                       | Implemented; Sentry adapter inert until wired |
| **Audit logs**          | `auditLog` (`src/lib/logging`) + `audit_logs` table / `features/audit` | Implemented                                   |

Two complementary subsystems:

```
@/lib/logging      → events with severity:  errorLog · auditLog · authLog · perfLog · appLog
                     sinks: Console (live) · Sentry · Logtail · OTel  (inert seams)

@/lib/monitoring   → aggregate numbers + health:  metrics (counter/gauge/histogram) · health
                     sinks: Prometheus exposition (Grafana on top)   (pull seam)
```

Logging answers _"what happened"_ (a stream of records); monitoring answers
_"how much / how fast / is it up"_ (aggregates + health). They share ambient
context (correlation id, environment, release) so signals cross-link.

---

## 2. Health endpoint

Three layers, cheapest first:

| Layer             | Path                   | Serves                                           | Use                                                                      |
| ----------------- | ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| **Edge liveness** | `GET /healthz` (Nginx) | static `200 ok`                                  | Container/LB/uptime probes — up even during app restarts (docs/NGINX.md) |
| **App liveness**  | `livenessResponse()`   | JSON: status, uptime, release                    | "process is up" without dependency I/O                                   |
| **App readiness** | `readinessResponse()`  | JSON: runs registered checks; `503` if unhealthy | Gate traffic on real dependency health (Supabase, etc.)                  |

The registry lives in `src/lib/monitoring/health.ts`. Register checks at server
bootstrap (checks are **injected** so the module stays free of Supabase/SDK
imports):

```ts
import { health, pingCheck } from "@/lib/monitoring";

health.register(
  "supabase",
  pingCheck(async () => {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/health`);
    if (!r.ok) throw new Error(`status ${r.status}`);
  }),
  { critical: true, timeoutMs: 2000 },
);
```

**Report shape** (`HealthReport`):

```json
{
  "status": "healthy", // healthy | degraded | unhealthy
  "version": "a1b2c3d", // COMMIT_SHA / VITE_COMMIT_SHA
  "release": "v1.4.0", // RELEASE / VITE_RELEASE
  "uptimeSeconds": 3421,
  "timestamp": "2026-07-03T12:00:00.000Z",
  "checks": { "supabase": { "status": "healthy", "detail": "reachable", "durationMs": 42 } }
}
```

Aggregation: a failing **critical** check → `unhealthy` (HTTP 503); a failing
**non-critical** check → `degraded` (still 200). Timeouts count as failures.

### Serving it over HTTP

The helpers return Web-standard `Response` objects, so they mount on any server
layer. This TanStack Start version has no file-based server routes, so choose:

- **Now:** Nginx already answers `/healthz` for liveness — that covers
  container/LB probes today.
- **App readiness:** mount `readinessResponse()` at `/api/health` from the
  request middleware (`src/start.ts`) or a Nitro route when you add one:

  ```ts
  // sketch — in a request-middleware branch
  if (url.pathname === "/api/health") return await readinessResponse();
  ```

Keep readiness on an **internal** path (or allow only Cloudflare/monitors) since
it reveals dependency status.

---

## 3. Application & performance metrics

A process-wide `MetricRegistry` collects counters, gauges, and histograms with
labels; the `metrics` facade gives call sites a consistent API:

```ts
import { metrics } from "@/lib/monitoring";

metrics.recordHttp("GET", "/app/tasks", 200, 34); // count + 5xx counter + latency histogram
metrics.recordError("render", { feature: "kanban" }); // errors_captured_total{kind,feature}
metrics.gauge("active_sessions", 128); // gauge
const stop = metrics.startTimer("route.tasks.load", { route: "/app/tasks" });
// …work…
stop(); // observes into operation_duration_seconds
```

Built-in series:

| Metric                          | Type      | Labels                | Meaning                    |
| ------------------------------- | --------- | --------------------- | -------------------------- |
| `http_requests_total`           | counter   | method, route, status | Request volume             |
| `http_errors_total`             | counter   | method, route         | 5xx responses              |
| `http_request_duration_seconds` | histogram | method, route         | Request latency            |
| `operation_duration_seconds`    | histogram | op                    | Arbitrary timed operations |
| `errors_captured_total`         | counter   | kind                  | Exceptions captured        |

**Performance metrics** are histograms (default web-latency buckets, seconds).
`perfLog` in `@/lib/logging` still emits per-event _timing logs_; use
`metrics.observeDuration`/`startTimer` to also aggregate them for dashboards.
Web Vitals (LCP/CLS/INP) can be fed in from the client via `metrics.observeDuration`
/ `metrics.gauge`.

### Exposition (Prometheus / Grafana)

`registry.render()` (or `metricsResponse()`) produces **Prometheus text
exposition format** via the pull-based `PrometheusAdapter` — no dependency, pure
mapping:

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/app/tasks",status="200"} 1
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/app/tasks",le="0.05"} 1
http_request_duration_seconds_bucket{method="GET",route="/app/tasks",le="+Inf"} 1
http_request_duration_seconds_sum{method="GET",route="/app/tasks"} 0.034
http_request_duration_seconds_count{method="GET",route="/app/tasks"} 1
```

Serve it at an **internal** `/metrics` (never public — it leaks route/volume
detail): mount `metricsResponse()` the same way as readiness, and restrict the
path to the Prometheus scraper's IP at Nginx.

> **Cardinality guard:** use bounded label values (route _templates_ like
> `/app/tasks/$id`, not raw ids). Unbounded labels explode memory and Prometheus
> series count.

---

## 4. Error tracking

Already provided by `@/lib/logging` — do not build a second path:

```ts
import { errorLog } from "@/lib/logging";
import { metrics } from "@/lib/monitoring";

try {
  /* … */
} catch (err) {
  errorLog.capture(err, { context: { feature: "attendance" } }); // serialized + redacted
  metrics.recordError("attendance"); // aggregate for alerting
}
```

- `errorLog.capture` / `errorLog.fatal` serialize + redact and emit to all sinks.
- The **`SentryAdapter`** (`src/lib/logging/adapters/sentry.ts`) is a prepared,
  inert seam — a pure `LogRecord → Sentry event` mapping that forwards to an
  injected client. Activation is a one-liner at bootstrap (see §6).
- The app's error boundary already reports via `reportLovableError`
  (`__root.tsx`); pairing it with `errorLog.capture` + `metrics.recordError`
  gives both a trace and a rate.

---

## 5. Audit logs

Sensitive actions use `auditLog` (`src/lib/logging/services.ts`) and persist to
the append-only `audit_logs` table (see [`docs/AUDIT_LOGS.md`](./AUDIT_LOGS.md),
`src/features/audit`):

```ts
import { auditLog } from "@/lib/logging";

const record = auditLog.record(
  { action: "role.grant", targetTable: "user_roles", targetId, after: { role } },
  ctx, // { correlationId, userId, actorRole }
);
// hand `record` to the service/DB layer to append to audit_logs (server-side)
```

`auditLog.record` redacts `before`/`after`/`diff`, emits to the log sinks, **and**
returns a redacted `AuditRecord` for the server to persist — the log stream and
the immutable DB trail stay in step, keyed by `correlationId`. Metrics can count
audited actions (`metrics.inc("audit_events_total", { action })`) for dashboards.

---

## 6. Future adapters

All three are **seams**, not dependencies — activate without touching call sites.

### Sentry (error tracking)

Prepared: `SentryAdapter` (`src/lib/logging/adapters/sentry.ts`).

```ts
// npm i @sentry/browser ; Sentry.init({ dsn, release, environment })
import { configureLogging } from "@/lib/logging";
import { SentryAdapter } from "@/lib/logging/adapters";
configureLogging({ addAdapters: [new SentryAdapter(Sentry)] });
```

Correlation id ↔ Sentry trace, release from `RELEASE`/`VITE_RELEASE`.

### Prometheus (metrics)

Prepared: `PrometheusAdapter` (registered by default; `registry.render()` works
now). Activation = **exposing `/metrics`** (internal path) + a Prometheus
`scrape_config` pointing at it. Optionally push via a StatsD/OTel-metrics adapter
implementing `MetricsAdapter.onObserve`.

### Grafana (dashboards & alerting)

Grafana sits **on top of** Prometheus (metrics) and, optionally, Loki (logs) or
Tempo (traces). No app code — add Prometheus/Loki as Grafana data sources and
build panels for the built-in series (§3), health status, error rate, and
latency percentiles. Alert rules: `up == 0`, `errors_captured_total` rate,
p95 `http_request_duration_seconds`, readiness `503`s.

### OpenTelemetry (traces/logs bridge)

Prepared: `OtelAdapter` (`src/lib/logging/adapters/otel.ts`) — pure mapping to
the OTel Logs Data Model; inject an exporter bridge to activate. A future
metrics-OTel adapter can mirror the registry to an OTLP metrics exporter.

---

## 7. Deployment topology

```
Browser / SSR ──► metrics + logging (in-process)
                     │
                     ├─ errorLog ──► Sentry            (when wired)
                     ├─ auditLog ──► audit_logs (DB, append-only)
                     └─ registry ──► /metrics (internal)
                                        ▲ scrape
Prometheus ─────────────────────────────┘ ──► Grafana (dashboards + alerts)

Uptime:  Cloudflare Health Check / UptimeRobot ──► https://app…/healthz  (Nginx)
```

- **Metrics** are per-process/in-memory; with multiple app containers, scrape
  each instance (distinct `instance` label) and aggregate in Prometheus.
- **Health**: edge `/healthz` for liveness (live now); app `/api/health` for
  readiness (mount per §2).
- **Errors/audit** flow through logging sinks; keep the service-role key and PII
  out of them (redaction is enforced in `src/lib/logging/redact.ts`).

---

## 8. What is and isn't wired today

- ✅ In-process metrics registry, Prometheus exposition, health registry +
  liveness/readiness reports, error/audit/perf logging — all implemented and
  type-checked, **inert until you register checks / mount endpoints**.
- ⚠️ **Not auto-wired** (deliberate, to avoid side effects): registering the
  Supabase health check, mounting `/api/health` and `/metrics`, and activating
  Sentry/Prometheus/Grafana. Do these at bootstrap/infra per §2, §3, §6.
- The subsystem adds **no runtime dependency** and no cost until used — matching
  how the logging vendor adapters ship "prepared but inert."

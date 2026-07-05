/**
 * Health — a provider-agnostic health-check registry and report builder for the
 * application health endpoint, plus Web-standard `Response` helpers to serve it.
 *
 *   - **Liveness**  — cheap "is the process up?" (no dependency I/O). Always 200
 *                     unless the process is broken. Nginx already serves a static
 *                     `/healthz` for this (docs/NGINX.md); this adds the app view.
 *   - **Readiness** — runs registered checks (e.g. Supabase reachability) and
 *                     returns `degraded`/`unhealthy` → 503 so orchestrators and
 *                     load balancers can stop routing to a bad instance.
 *
 * Checks are injected (no Supabase import here) to keep this isomorphic and
 * dependency-free. See docs/MONITORING.md for wiring.
 */
import type {
  HealthCheck,
  HealthCheckConfig,
  HealthCheckResult,
  HealthReport,
  HealthStatus,
} from "./types";

const PROCESS_START = Date.now();

/** Worst-wins ordering for aggregation. */
const STATUS_RANK: Record<HealthStatus, number> = { unhealthy: 0, degraded: 1, healthy: 2 };

function envValue(viteKey: string, nodeKey: string): string | undefined {
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined> | undefined)?.[viteKey]
      : undefined;
  const fromNode = typeof process !== "undefined" ? process.env?.[nodeKey] : undefined;
  return fromVite ?? fromNode;
}

function uptimeSeconds(): number {
  return Math.floor((Date.now() - PROCESS_START) / 1000);
}

interface RegisteredCheck {
  name: string;
  check: HealthCheck;
  critical: boolean;
  timeoutMs: number;
}

export class HealthRegistry {
  private checks: RegisteredCheck[] = [];

  /** Register a probe. Critical failures make the whole report `unhealthy`. */
  register(name: string, check: HealthCheck, config: HealthCheckConfig = {}): this {
    this.checks.push({
      name,
      check,
      critical: config.critical ?? true,
      timeoutMs: config.timeoutMs ?? 2000,
    });
    return this;
  }

  /** Remove all checks (tests). */
  clear(): void {
    this.checks = [];
  }

  private async runOne(rc: RegisteredCheck): Promise<HealthCheckResult> {
    const t0 = Date.now();
    try {
      const result = await Promise.race([
        Promise.resolve(rc.check()),
        new Promise<HealthCheckResult>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout after ${rc.timeoutMs}ms`)), rc.timeoutMs),
        ),
      ]);
      return { durationMs: Date.now() - t0, ...result };
    } catch (err) {
      return {
        status: "unhealthy",
        detail: err instanceof Error ? err.message : "check failed",
        durationMs: Date.now() - t0,
      };
    }
  }

  /** Cheap liveness report — no checks executed. */
  liveness(): HealthReport {
    return {
      status: "healthy",
      version: envValue("VITE_COMMIT_SHA", "COMMIT_SHA"),
      release: envValue("VITE_RELEASE", "RELEASE"),
      uptimeSeconds: uptimeSeconds(),
      timestamp: new Date().toISOString(),
      checks: {},
    };
  }

  /** Readiness report — runs every registered check and aggregates status. */
  async readiness(): Promise<HealthReport> {
    const results = await Promise.all(
      this.checks.map(async (rc) => [rc, await this.runOne(rc)] as const),
    );

    const checks: Record<string, HealthCheckResult> = {};
    let overall: HealthStatus = "healthy";
    for (const [rc, result] of results) {
      checks[rc.name] = result;
      if (result.status === "healthy") continue;
      // A failing critical check → unhealthy; a non-critical failure → at least degraded.
      const contributed: HealthStatus = rc.critical ? result.status : "degraded";
      if (STATUS_RANK[contributed] < STATUS_RANK[overall]) overall = contributed;
    }

    return {
      status: overall,
      version: envValue("VITE_COMMIT_SHA", "COMMIT_SHA"),
      release: envValue("VITE_RELEASE", "RELEASE"),
      uptimeSeconds: uptimeSeconds(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

/** The process-wide registry. Register checks at server bootstrap. */
export const health = new HealthRegistry();

/**
 * A reusable dependency check built from a ping function. The caller injects the
 * probe (e.g. a `fetch` HEAD to the Supabase REST base, or `select 1`), so this
 * module stays free of Supabase/SDK imports.
 *
 * @example
 *   health.register("supabase", pingCheck(async () => {
 *     const r = await fetch(`${url}/auth/v1/health`, { method: "GET" });
 *     if (!r.ok) throw new Error(`status ${r.status}`);
 *   }), { critical: true });
 */
export function pingCheck(ping: () => Promise<void>, okDetail = "reachable"): HealthCheck {
  return async () => {
    await ping();
    return { status: "healthy", detail: okDetail };
  };
}

/** Map a report to an HTTP status: unhealthy → 503, else 200. */
export function healthStatusCode(report: HealthReport): number {
  return report.status === "unhealthy" ? 503 : 200;
}

/** Build a Web `Response` for a liveness probe (always cheap). */
export function livenessResponse(): Response {
  const report = health.liveness();
  return jsonResponse(report, 200);
}

/** Build a Web `Response` for a readiness probe (runs checks). */
export async function readinessResponse(): Promise<Response> {
  const report = await health.readiness();
  return jsonResponse(report, healthStatusCode(report));
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

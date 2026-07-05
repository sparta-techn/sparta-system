import { describe, expect, it, vi } from "vitest";
import { Logger, serializeError } from "./logger";
import { REDACTED } from "./redact";
import { toLogtailPayload } from "./adapters/logtail";
import { toSentryEvent } from "./adapters/sentry";
import { toOtelSeverity } from "./adapters/otel";
import type { LogAdapter, LogRecord } from "./types";

function memoryAdapter(minLevel?: LogRecord["level"]) {
  const records: LogRecord[] = [];
  const adapter: LogAdapter = {
    name: "memory",
    minLevel,
    handle: (r) => records.push(r),
  };
  return { adapter, records };
}

function makeLogger(level: LogRecord["level"] = "debug", adapters: LogAdapter[] = []) {
  return new Logger({ level, adapters, useAmbientContext: false });
}

describe("Logger", () => {
  it("drops records below the global level", () => {
    const { adapter, records } = memoryAdapter();
    const log = makeLogger("warn", [adapter]);
    log.info("skipped");
    log.warn("kept");
    expect(records.map((r) => r.message)).toEqual(["kept"]);
  });

  it("respects per-adapter minLevel", () => {
    const quiet = memoryAdapter("error");
    const chatty = memoryAdapter();
    const log = makeLogger("debug", [quiet.adapter, chatty.adapter]);
    log.info("info");
    log.error("err");
    expect(quiet.records.map((r) => r.message)).toEqual(["err"]);
    expect(chatty.records.map((r) => r.message)).toEqual(["info", "err"]);
  });

  it("redacts structured data before dispatch", () => {
    const { adapter, records } = memoryAdapter();
    const log = makeLogger("debug", [adapter]);
    log.info("login", { email: "a@b.com", password: "secret" });
    expect(records[0].data).toEqual({ email: "a@b.com", password: REDACTED });
  });

  it("merges base and per-call context", () => {
    const { adapter, records } = memoryAdapter();
    const log = new Logger({
      level: "debug",
      adapters: [adapter],
      useAmbientContext: false,
      baseContext: { feature: "auth" },
    });
    log.emit("info", "application", "x", { context: { route: "/auth" } });
    expect(records[0].context).toMatchObject({ feature: "auth", route: "/auth" });
  });

  it("isolates a throwing adapter from siblings", () => {
    const bad: LogAdapter = {
      name: "bad",
      handle: () => {
        throw new Error("sink down");
      },
    };
    const good = memoryAdapter();
    const log = makeLogger("debug", [bad, good.adapter]);
    expect(() => log.info("still works")).not.toThrow();
    expect(good.records).toHaveLength(1);
  });

  it("child loggers inherit and extend context", () => {
    const { adapter, records } = memoryAdapter();
    const log = makeLogger("debug", [adapter]).child({ feature: "hr" });
    log.info("hi");
    expect(records[0].context.feature).toBe("hr");
  });

  it("flush awaits batched adapters", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const log = makeLogger("debug", [{ name: "batch", handle: () => {}, flush }]);
    await log.flush();
    expect(flush).toHaveBeenCalledOnce();
  });
});

describe("serializeError", () => {
  it("serializes Error with code and cause", () => {
    const err = Object.assign(new Error("outer"), {
      code: "E_X",
      cause: new Error("inner"),
    });
    const out = serializeError(err);
    expect(out).toMatchObject({ name: "Error", message: "outer", code: "E_X" });
    expect(out.cause).toMatchObject({ message: "inner" });
  });
  it("handles strings and unknowns", () => {
    expect(serializeError("boom")).toMatchObject({ message: "boom" });
    expect(serializeError(42).message).toBe("42");
  });
});

describe("adapter mappings", () => {
  const record: LogRecord = {
    timestamp: "2026-01-01T00:00:00.000Z",
    level: "error",
    category: "error",
    message: "kaboom",
    context: { correlationId: "cid-1", feature: "attendance", environment: "test" },
    error: { name: "Error", message: "kaboom" },
  };

  it("toSentryEvent maps level and tags", () => {
    const ev = toSentryEvent(record);
    expect(ev.level).toBe("error");
    expect(ev.tags.correlation_id).toBe("cid-1");
    expect(ev.exception?.message).toBe("kaboom");
  });

  it("toLogtailPayload maps timestamp and correlation id", () => {
    const p = toLogtailPayload(record);
    expect(p.dt).toBe("2026-01-01T00:00:00.000Z");
    expect(p.correlation_id).toBe("cid-1");
    expect(p.level).toBe("error");
  });

  it("toOtelSeverity maps levels to numbers", () => {
    expect(toOtelSeverity("info").number).toBe(9);
    expect(toOtelSeverity("error").text).toBe("ERROR");
  });
});

import { describe, expect, it } from "vitest";
import { REDACTED, maskEmail, redact, redactRecord } from "./redact";

describe("redact", () => {
  it("masks sensitive keys at any depth", () => {
    const input = {
      email: "a@b.com",
      password: "hunter2",
      nested: { apiKey: "sk-123", token: "t", ok: 1 },
      list: [{ secret: "x" }, { fine: true }],
    };
    const out = redact(input) as Record<string, unknown>;
    expect(out.password).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).apiKey).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).token).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect((out.list as Record<string, unknown>[])[0].secret).toBe(REDACTED);
    expect((out.list as Record<string, unknown>[])[1].fine).toBe(true);
  });

  it("matches case-insensitively and common variants", () => {
    const out = redact({
      Password: "x",
      access_key: "x",
      Authorization: "Bearer y",
      salary: 100000,
    }) as Record<string, unknown>;
    expect(out.Password).toBe(REDACTED);
    expect(out.access_key).toBe(REDACTED);
    expect(out.Authorization).toBe(REDACTED);
    expect(out.salary).toBe(REDACTED);
  });

  it("is cycle-safe", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    const out = redact(a) as Record<string, unknown>;
    expect(out.name).toBe("a");
    expect(out.self).toBe("<circular>");
  });

  it("truncates beyond max depth", () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    const out = redact(deep, { maxDepth: 3 }) as Record<string, unknown>;
    // a(1) -> b(2) -> c(3) hits the cap
    const c = ((out.a as Record<string, unknown>).b as Record<string, unknown>).c;
    expect(c).toBe("<max-depth>");
  });

  it("normalizes Date and Error, drops functions", () => {
    const out = redact({
      when: new Date("2026-01-01T00:00:00.000Z"),
      err: new Error("boom"),
      fn: () => 1,
    }) as Record<string, unknown>;
    expect(out.when).toBe("2026-01-01T00:00:00.000Z");
    expect((out.err as Record<string, unknown>).message).toBe("boom");
    expect(out.fn).toBeUndefined();
  });

  it("supports extra key patterns", () => {
    const out = redact({ customField: "x" }, { extraKeys: [/customField/i] }) as Record<
      string,
      unknown
    >;
    expect(out.customField).toBe(REDACTED);
  });

  it("redactRecord returns undefined for nullish", () => {
    expect(redactRecord(null)).toBeUndefined();
    expect(redactRecord(undefined)).toBeUndefined();
    expect(redactRecord({ token: "x", n: 1 })).toEqual({ token: REDACTED, n: 1 });
  });
});

describe("maskEmail", () => {
  it("masks local and domain but keeps the tld", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j***@e***.com");
  });
  it("handles nullish and non-emails", () => {
    expect(maskEmail(undefined)).toBeUndefined();
    expect(maskEmail("")).toBeUndefined();
    expect(maskEmail("notanemail")).toBe(REDACTED);
  });
});

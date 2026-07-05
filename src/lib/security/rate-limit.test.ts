import { describe, expect, it } from "vitest";

import { RateLimiter } from "./rate-limit";

describe("RateLimiter (token bucket)", () => {
  it("allows up to capacity then blocks", () => {
    const now = 1_000;
    const rl = new RateLimiter({ capacity: 3, refillPerSecond: 1, now: () => now });

    expect(rl.check("u1").allowed).toBe(true);
    expect(rl.check("u1").allowed).toBe(true);
    const third = rl.check("u1");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = rl.check("u1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("refills over time", () => {
    let now = 0;
    const rl = new RateLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });
    rl.check("u1");
    rl.check("u1");
    expect(rl.check("u1").allowed).toBe(false);

    now += 1_000; // 1 token back
    expect(rl.check("u1").allowed).toBe(true);
    expect(rl.check("u1").allowed).toBe(false);
  });

  it("tracks identities independently", () => {
    const now = 0;
    const rl = new RateLimiter({ capacity: 1, refillPerSecond: 0, now: () => now });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(false);
    expect(rl.check("b").allowed).toBe(true);
  });
});

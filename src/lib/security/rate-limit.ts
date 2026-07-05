/**
 * Rate-limiting preparation.
 *
 * A production deployment must throttle abuse-prone endpoints (auth, password
 * reset, AI calls, write-heavy mutations). This module provides a small, correct
 * **token-bucket** limiter behind a pluggable store so the call sites can be
 * wired now and the backing store swapped for a distributed one later.
 *
 * ⚠️ The default {@link InMemoryRateLimitStore} is per-instance only — it does
 * NOT coordinate across serverless instances/edge regions. Before going to
 * production behind multiple instances, back {@link RateLimiter} with a shared
 * store (Supabase table with an atomic RPC, Upstash/Redis, or Cloudflare KV/DO).
 * See `docs/SECURITY.md` → "Rate limiting".
 */

export interface RateLimitResult {
  /** Whether this request is allowed. */
  allowed: boolean;
  /** Tokens left in the current window. */
  remaining: number;
  /** Epoch ms when the bucket is fully refilled. */
  resetAt: number;
  /** Seconds to wait before retrying (0 when allowed). */
  retryAfter: number;
}

interface BucketState {
  tokens: number;
  updatedAt: number;
}

/** Storage contract so the limiter can move off in-memory state. */
export interface RateLimitStore {
  get(key: string): BucketState | undefined;
  set(key: string, state: BucketState): void;
}

/** Default single-instance store. Not safe across multiple instances. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, BucketState>();
  get(key: string): BucketState | undefined {
    return this.map.get(key);
  }
  set(key: string, state: BucketState): void {
    this.map.set(key, state);
  }
}

export interface RateLimiterOptions {
  /** Max tokens (burst capacity). */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
  /** Backing store (defaults to in-memory). */
  store?: RateLimitStore;
  /** Injectable clock for tests. */
  now?: () => number;
}

/**
 * Token-bucket rate limiter. `check(key)` consumes one token for the identity
 * (user id, IP, or `${ip}:${route}`) and reports whether the caller may proceed.
 */
export class RateLimiter {
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly store: RateLimitStore;
  private readonly now: () => number;

  constructor(opts: RateLimiterOptions) {
    this.capacity = opts.capacity;
    this.refillPerSecond = opts.refillPerSecond;
    this.store = opts.store ?? new InMemoryRateLimitStore();
    this.now = opts.now ?? (() => Date.now());
  }

  check(key: string, cost = 1): RateLimitResult {
    const now = this.now();
    const prior = this.store.get(key) ?? { tokens: this.capacity, updatedAt: now };

    const elapsedSec = Math.max(0, (now - prior.updatedAt) / 1000);
    const refilled = Math.min(this.capacity, prior.tokens + elapsedSec * this.refillPerSecond);

    const allowed = refilled >= cost;
    const tokens = allowed ? refilled - cost : refilled;
    this.store.set(key, { tokens, updatedAt: now });

    const deficit = allowed ? 0 : cost - tokens;
    const secondsToRefill = this.refillPerSecond > 0 ? deficit / this.refillPerSecond : Infinity;
    const fullRefillSec = (this.capacity - tokens) / this.refillPerSecond;

    return {
      allowed,
      remaining: Math.floor(tokens),
      resetAt: now + Math.ceil(fullRefillSec * 1000),
      retryAfter: allowed ? 0 : Math.ceil(secondsToRefill),
    };
  }
}

/**
 * Suggested limits per sensitive action. Tune against real traffic; these are
 * conservative starting points and are consumed by call sites once wired.
 */
export const RATE_LIMIT_PRESETS = {
  /** Sign-in / token endpoints — 5 attempts, ~1 per 12s recovery. */
  auth: { capacity: 5, refillPerSecond: 1 / 12 },
  /** Password reset / invitation email sends — 3 per ~5 min. */
  passwordReset: { capacity: 3, refillPerSecond: 1 / 100 },
  /** AI generation calls — 20 burst, 1 per 3s. */
  ai: { capacity: 20, refillPerSecond: 1 / 3 },
  /** Generic write mutations — 60 burst, 2/s. */
  write: { capacity: 60, refillPerSecond: 2 },
} as const satisfies Record<string, Pick<RateLimiterOptions, "capacity" | "refillPerSecond">>;

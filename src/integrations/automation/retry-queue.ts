/**
 * InMemoryRetryQueue — a working, deterministic retry buffer for outgoing
 * deliveries.
 *
 * This is real internal infrastructure (no external calls): it schedules retries
 * with exponential backoff and reports when a delivery has exhausted its attempts
 * so the caller can dead-letter it. It is the seam a durable, Supabase-backed
 * queue slots into later — same interface, persistent storage. Fully unit-testable.
 */

import type {
  DeadLetterEntry,
  DeliveryAttempt,
  EnqueueInput,
  QueuedDelivery,
  RetryPolicy,
  RetryQueue,
} from "../ports";

/** Sensible default backoff: 5 attempts, 1s → 5m, doubling. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 300_000,
  factor: 2,
  jitter: false,
};

/** Delay before the Nth attempt (1-based), capped at `maxDelayMs`. */
export function nextBackoffMs(policy: RetryPolicy, attempt: number): number {
  const raw = policy.baseDelayMs * policy.factor ** Math.max(0, attempt - 1);
  const capped = Math.min(policy.maxDelayMs, raw);
  if (!policy.jitter) return capped;
  // Full jitter in [0, capped].
  return Math.floor(Math.random() * capped);
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `dlv_${Date.now().toString(36)}_${counter}`;
}

export class InMemoryRetryQueue implements RetryQueue {
  private readonly items = new Map<string, QueuedDelivery>();

  constructor(private readonly defaultPolicy: RetryPolicy = DEFAULT_RETRY_POLICY) {}

  enqueue(input: EnqueueInput): QueuedDelivery {
    const policy = input.policy ?? this.defaultPolicy;
    const now = new Date();
    // The initial inline send already failed → this is attempt 1.
    const attempts = 1;
    const attempt: DeliveryAttempt = {
      attempt: attempts,
      at: now.toISOString(),
      state: "retrying",
      detail: input.error,
    };
    const delivery: QueuedDelivery = {
      id: nextId(),
      accountId: input.accountId,
      message: input.message,
      attempts,
      policy,
      nextAttemptAt: new Date(now.getTime() + nextBackoffMs(policy, attempts)).toISOString(),
      lastError: input.error,
      history: [attempt],
    };
    this.items.set(delivery.id, delivery);
    return delivery;
  }

  due(now: Date = new Date()): readonly QueuedDelivery[] {
    return [...this.items.values()].filter(
      (item) => new Date(item.nextAttemptAt).getTime() <= now.getTime(),
    );
  }

  recordSuccess(id: string): void {
    this.items.delete(id);
  }

  recordFailure(id: string, error: string): DeadLetterEntry | null {
    const item = this.items.get(id);
    if (!item) return null;

    const attempts = item.attempts + 1;
    const now = new Date();
    const attempt: DeliveryAttempt = { attempt: attempts, at: now.toISOString(), state: "retrying", detail: error };

    if (attempts >= item.policy.maxAttempts) {
      this.items.delete(id);
      return {
        id: item.id,
        accountId: item.accountId,
        message: item.message,
        attempts,
        reason: error,
        deadLetteredAt: now.toISOString(),
      };
    }

    this.items.set(id, {
      ...item,
      attempts,
      lastError: error,
      nextAttemptAt: new Date(now.getTime() + nextBackoffMs(item.policy, attempts)).toISOString(),
      history: [...item.history, attempt],
    });
    return null;
  }

  peek(id: string): QueuedDelivery | undefined {
    return this.items.get(id);
  }

  size(): number {
    return this.items.size;
  }
}

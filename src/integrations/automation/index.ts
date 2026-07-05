/**
 * Shared automation infrastructure — the vendor-neutral machinery n8n / Zapier /
 * Make all reuse. See `docs/AUTOMATION.md`.
 */

export type { AutomationTransport } from "./automation-transport";
export { AutomationService } from "./automation-service";
export { InMemoryRetryQueue, DEFAULT_RETRY_POLICY, nextBackoffMs } from "./retry-queue";
export { InMemoryDeadLetterQueue } from "./dead-letter-queue";

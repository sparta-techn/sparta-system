/**
 * Automation engine. Listens to the event bus, runs all registered rules,
 * resolves recipient targeting, consults user preferences, and dispatches
 * notifications through the channel registry.
 *
 *   Business module → eventBus.publish(...)
 *                       ↓
 *                  automationEngine
 *                       ↓
 *               notificationStore + channels
 */

import { getChannel, registerChannel } from "./channels";
import { resolveRecipients } from "./directory";
import { eventBus } from "./event-bus";
import { isInQuietHours, preferences } from "./preferences";
import { defaultRules } from "./rules";
import { notificationStore } from "./store";
import type {
  AppNotification,
  AutomationRule,
  DomainEvent,
  NotificationSpec,
} from "./types";

const rules: AutomationRule[] = [...defaultRules];

export function registerRule(rule: AutomationRule) {
  if (!rules.find((r) => r.id === rule.id)) rules.push(rule);
}

function nid() {
  return `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function specToNotifications(
  spec: NotificationSpec,
  event: DomainEvent,
): AppNotification[] {
  const prefs = preferences.get();
  if (prefs.categories[spec.category] === false) return [];
  // Per-recipient personalised notification.
  const recipients = resolveRecipients(spec.recipients);
  const channels = (spec.channels ?? ["in_app"]).filter(
    (c) => getChannel(c)?.enabled,
  );
  if (!channels.length) return [];

  const ttl = spec.ttlMinutes ?? 60 * 24 * 30;
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  const inQuiet = isInQuietHours(prefs);
  const allowed =
    !inQuiet || spec.priority === "critical" || spec.type === "critical";
  if (!allowed) return [];

  return recipients.map((recipientId) => ({
    id: nid(),
    eventId: event.id,
    eventName: event.name,
    category: spec.category,
    type: spec.type,
    priority: spec.priority,
    title: spec.title,
    body: spec.body,
    recipientId,
    channels,
    actions: spec.actions,
    href: spec.href,
    createdAt: event.occurredAt,
    expiresAt,
    meta: spec.meta,
  }));
}

function handle(event: DomainEvent) {
  const matched = rules.filter((r) => r.on.includes(event.name));
  const produced: AppNotification[] = [];
  for (const rule of matched) {
    if (rule.when && !rule.when(event)) continue;
    let specs: NotificationSpec[] = [];
    try {
      specs = rule.build(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[automation] rule ${rule.id} threw`, err);
      continue;
    }
    for (const spec of specs) {
      produced.push(...specToNotifications(spec, event));
    }
  }
  if (!produced.length) return;
  notificationStore.addMany(produced);
  produced.forEach((n) => {
    n.channels.forEach((cid) => {
      try {
        void getChannel(cid)?.deliver(n);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[channel] deliver failed", cid, err);
      }
    });
  });
}

let started = false;
let unsubscribe: (() => void) | null = null;

/** Register the in-app channel and subscribe the engine to the bus. */
export function startAutomationEngine() {
  if (started) return;
  started = true;
  registerChannel({
    id: "in_app",
    enabled: true,
    deliver: () => {
      /* notificationStore already received the row; no extra side effects */
    },
  });
  unsubscribe = eventBus.subscribe(handle);
}

export function stopAutomationEngine() {
  unsubscribe?.();
  unsubscribe = null;
  started = false;
}

export const automationEngine = {
  start: startAutomationEngine,
  stop: stopAutomationEngine,
  registerRule,
  /** Test helper: run rules over an event without touching the bus. */
  dispatch: handle,
};

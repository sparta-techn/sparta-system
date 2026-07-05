/**
 * Lightweight in-memory event bus.
 *
 * Business modules call `publish(...)` after a domain action; everything
 * else (automation engine, audit log, future analytics) subscribes here.
 * No module imports the notification store directly.
 */

import type { DomainEvent, EventCategory, EventName } from "./types";

type Handler = (event: DomainEvent) => void;

const handlers = new Set<Handler>();
const recent: DomainEvent[] = [];
const MAX_RECENT = 200;

function categoryOf(name: EventName): EventCategory {
  const prefix = name.split(".")[0] as EventCategory;
  switch (prefix) {
    case "attendance":
    case "dependency":
    case "announcement":
    case "user":
    case "task":
    case "sprint":
    case "comment":
    case "mention":
    case "leave":
      return prefix;
    case "checkin" as EventCategory:
      return "checkin";
    case "midday" as EventCategory:
      return "midday";
    case "eod" as EventCategory:
      return "eod";
    default:
      return "system";
  }
}

function nextId() {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const eventBus = {
  publish<P extends Record<string, unknown> = Record<string, unknown>>(input: {
    name: EventName;
    actorId: string | "system";
    subjectId?: string;
    payload?: P;
  }): DomainEvent<P> {
    const event: DomainEvent<P> = {
      id: nextId(),
      name: input.name,
      category: categoryOf(input.name),
      actorId: input.actorId,
      subjectId: input.subjectId,
      payload: input.payload ?? ({} as P),
      occurredAt: new Date().toISOString(),
    };
    recent.push(event as DomainEvent);
    if (recent.length > MAX_RECENT) recent.shift();
    // Deliver synchronously; handlers are expected to be cheap.
    handlers.forEach((h) => {
      try {
        h(event as DomainEvent);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[eventBus] handler failed", err);
      }
    });
    return event;
  },
  subscribe(handler: Handler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
  recent() {
    return [...recent];
  },
};

export type { Handler };

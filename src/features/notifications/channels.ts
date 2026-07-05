/**
 * Channel registry. Adding a future channel (email, slack, etc.) means
 * implementing this interface and calling `registerChannel(...)`. No
 * change to business modules or the automation engine is required.
 */

import type { AppNotification, DeliveryChannel } from "./types";

export interface NotificationChannel {
  id: DeliveryChannel;
  /** True if this channel is wired and may deliver in this build. */
  enabled: boolean;
  deliver(notification: AppNotification): Promise<void> | void;
}

const registry = new Map<DeliveryChannel, NotificationChannel>();

export function registerChannel(channel: NotificationChannel) {
  registry.set(channel.id, channel);
}

export function getChannel(id: DeliveryChannel) {
  return registry.get(id);
}

export function listChannels(): NotificationChannel[] {
  return [...registry.values()];
}

/**
 * Stubs for future channels. They are registered as disabled so the UI
 * can show them in preferences, but `deliver` is a no-op until real
 * integrations are wired.
 */
const FUTURE: DeliveryChannel[] = [
  "email",
  "slack",
  "teams",
  "telegram",
  "whatsapp",
  "push",
  "sms",
];

FUTURE.forEach((id) =>
  registerChannel({
    id,
    enabled: false,
    deliver: () => {
      /* future integration */
    },
  }),
);

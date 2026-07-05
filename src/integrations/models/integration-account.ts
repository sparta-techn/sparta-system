/**
 * IntegrationAccount — model + factory helpers around {@link IntegrationAccountData}.
 *
 * Keeps account construction and safe (redacted) serialization in one place so
 * no adapter hand-builds account rows or accidentally leaks a credential ref to
 * the client.
 */

import type {
  ConnectInput,
  IntegrationAccountData,
  IntegrationId,
  IntegrationSettings,
} from "../types";

/** UUID generator that degrades gracefully where `crypto` is unavailable. */
function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Non-cryptographic fallback (tests / older runtimes only).
  return `acc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** The account shape safe to return to the client (credential ref stripped). */
export type PublicIntegrationAccount = Omit<IntegrationAccountData, "credentialRef">;

export const IntegrationAccount = {
  /** Build a fresh, active account row from a connect request. */
  create(params: {
    integrationId: IntegrationId;
    input: ConnectInput;
    externalAccountId: string;
    credentialRef: string;
    settings?: IntegrationSettings;
  }): IntegrationAccountData {
    const now = new Date().toISOString();
    return {
      id: newId(),
      integrationId: params.integrationId,
      scope: params.input.scope,
      ownerId: params.input.ownerId,
      externalAccountId: params.externalAccountId,
      status: "active",
      credentialRef: params.credentialRef,
      settings: params.settings ?? params.input.settings ?? {},
      createdAt: now,
      updatedAt: now,
    };
  },

  /** Strip the credential ref for anything that crosses to the client. */
  toPublic(account: IntegrationAccountData): PublicIntegrationAccount {
    const { credentialRef: _omit, ...rest } = account;
    void _omit;
    return rest;
  },
};

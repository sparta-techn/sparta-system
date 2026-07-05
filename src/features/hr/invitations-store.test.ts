import { afterEach, describe, expect, it } from "vitest";

import {
  __resetInvitations,
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  effectiveStatus,
  getInvitation,
  getSettings,
  listInvitations,
  resendInvitation,
  updateSettings,
} from "./invitations-store";
import type { HrInvitation } from "./mock-data";

afterEach(() => __resetInvitations());

function makeInvite(overrides: Partial<Parameters<typeof createInvitation>[0]> = {}) {
  return createInvitation({
    email: "New.Hire@spartaflow.dev",
    role: "employee",
    department: "Engineering",
    ...overrides,
  });
}

describe("createInvitation", () => {
  it("creates a pending invite, normalises email, and honours the default window", () => {
    updateSettings({ expiryDays: 7 });
    const inv = makeInvite({ name: "  New Hire  " });

    expect(inv.status).toBe("pending");
    expect(inv.email).toBe("new.hire@spartaflow.dev");
    expect(inv.name).toBe("New Hire");
    expect(inv.token).toBeTruthy();

    const windowDays =
      (new Date(inv.expiresAt).getTime() - new Date(inv.invitedAt).getTime()) / 86_400_000;
    expect(Math.round(windowDays)).toBe(7);
  });

  it("lets a per-invite expiryDays override the default", () => {
    updateSettings({ expiryDays: 7 });
    const inv = makeInvite({ expiryDays: 30 });
    const windowDays =
      (new Date(inv.expiresAt).getTime() - new Date(inv.invitedAt).getTime()) / 86_400_000;
    expect(Math.round(windowDays)).toBe(30);
  });

  it("prepends the new invite to the list", () => {
    const inv = makeInvite();
    expect(listInvitations()[0].id).toBe(inv.id);
  });
});

describe("effectiveStatus (expiry derivation)", () => {
  const base: HrInvitation = {
    id: "x",
    email: "a@b.dev",
    role: "employee",
    department: "Engineering",
    invitedBy: "Tester",
    invitedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    status: "pending",
  };

  it("reports a past-due pending invite as expired without mutation", () => {
    const past = { ...base, expiresAt: new Date(Date.now() - 1_000).toISOString() };
    expect(effectiveStatus(past)).toBe("expired");
    expect(past.status).toBe("pending"); // stored status untouched
  });

  it("keeps a future pending invite pending", () => {
    const future = { ...base, expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
    expect(effectiveStatus(future)).toBe("pending");
  });

  it("never re-derives a terminal status", () => {
    const cancelled = {
      ...base,
      status: "cancelled" as const,
      expiresAt: new Date(0).toISOString(),
    };
    expect(effectiveStatus(cancelled)).toBe("cancelled");
  });
});

describe("resendInvitation", () => {
  it("refreshes the window, rotates the token, and returns to pending", () => {
    updateSettings({ expiryDays: 14 });
    const inv = makeInvite({ expiryDays: 3 });
    const resent = resendInvitation(inv.id)!;

    expect(resent.status).toBe("pending");
    expect(resent.token).not.toBe(inv.token);
    expect(resent.resentAt).toBeTruthy();
    const windowDays =
      (new Date(resent.expiresAt).getTime() - new Date(resent.invitedAt).getTime()) / 86_400_000;
    expect(Math.round(windowDays)).toBe(14); // uses current default, not original
  });
});

describe("cancelInvitation", () => {
  it("marks the invite cancelled", () => {
    const inv = makeInvite();
    expect(cancelInvitation(inv.id)!.status).toBe("cancelled");
    expect(getInvitation(inv.id)!.status).toBe("cancelled");
  });
});

describe("acceptInvitation", () => {
  it("accepts a pending invite and stamps acceptedAt", () => {
    const inv = makeInvite();
    const accepted = acceptInvitation(inv.id)!;
    expect(accepted.status).toBe("accepted");
    expect(accepted.acceptedAt).toBeTruthy();
  });

  it("is a no-op for a cancelled invite", () => {
    const inv = makeInvite();
    cancelInvitation(inv.id);
    expect(acceptInvitation(inv.id)).toBeNull();
    expect(getInvitation(inv.id)!.status).toBe("cancelled");
  });
});

describe("updateSettings", () => {
  it("persists the default expiry window", () => {
    updateSettings({ expiryDays: 30 });
    expect(getSettings().expiryDays).toBe(30);
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  __resetSystem,
  getFlags,
  getMaintenance,
  getSettings,
  isFeatureEnabled,
  setFeatureFlag,
  setMaintenance,
  updateSettings,
} from "./system-store";
import { __resetAudit, listAudit } from "@/features/audit/audit-store";

afterEach(() => {
  __resetSystem();
  __resetAudit();
});

describe("system settings", () => {
  it("patches settings and audits each changed field", () => {
    __resetAudit();
    const next = updateSettings({ companyName: "Acme Inc", sessionTimeoutMinutes: 30 });
    expect(next.companyName).toBe("Acme Inc");
    expect(getSettings().sessionTimeoutMinutes).toBe(30);

    const audits = listAudit().filter((a) => a.action === "settings_changed");
    expect(audits.some((a) => a.target === "Company name" && a.newValue === "Acme Inc")).toBe(true);
    expect(audits.some((a) => a.target === "Session timeout" && a.newValue === "30")).toBe(true);
  });

  it("does not audit unchanged fields", () => {
    __resetAudit();
    const before = listAudit().length;
    updateSettings({ companyName: getSettings().companyName });
    expect(listAudit().length).toBe(before);
  });
});

describe("feature flags", () => {
  it("toggles a flag and reflects it in isFeatureEnabled", () => {
    expect(isFeatureEnabled("kanban_v2")).toBe(false);
    setFeatureFlag("kanban_v2", true);
    expect(isFeatureEnabled("kanban_v2")).toBe(true);
    expect(getFlags().find((f) => f.key === "kanban_v2")?.enabled).toBe(true);
  });

  it("unknown flags default to enabled", () => {
    expect(isFeatureEnabled("does_not_exist")).toBe(true);
  });

  it("audits flag changes", () => {
    __resetAudit();
    setFeatureFlag("integrations", false);
    const audit = listAudit().find((a) => a.target === "Feature flag: Integrations");
    expect(audit?.oldValue).toBe("on");
    expect(audit?.newValue).toBe("off");
  });
});

describe("maintenance mode", () => {
  it("enables, stamps startedAt, and audits", () => {
    __resetAudit();
    const state = setMaintenance({ enabled: true });
    expect(state.enabled).toBe(true);
    expect(state.startedAt).toBeTruthy();
    expect(listAudit().some((a) => a.target === "Maintenance mode" && a.newValue === "on")).toBe(
      true,
    );
  });

  it("clears startedAt when disabled", () => {
    setMaintenance({ enabled: true });
    const state = setMaintenance({ enabled: false });
    expect(state.enabled).toBe(false);
    expect(state.startedAt).toBeNull();
  });

  it("updates the message without toggling", () => {
    setMaintenance({ message: "Back at 5pm UTC" });
    expect(getMaintenance().message).toBe("Back at 5pm UTC");
    expect(getMaintenance().enabled).toBe(false);
  });
});

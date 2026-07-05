import { afterEach, describe, expect, it } from "vitest";

import { __resetAudit, filterAudit, listAudit, recordAudit, setCurrentActor } from "./audit-store";
import { ACTION_CATEGORY } from "./types";

afterEach(() => {
  __resetAudit();
  setCurrentActor(null);
});

describe("recordAudit", () => {
  it("prepends an event and stamps id, time, category, and reserved fields", () => {
    const before = listAudit().length;
    const event = recordAudit({ action: "login", target: "a@b.dev", targetType: "session" })!;

    expect(event).not.toBeNull();
    expect(event.id).toBeTruthy();
    expect(event.at).toBeTruthy();
    expect(event.category).toBe(ACTION_CATEGORY.login);
    // IP / device are reserved for the server-side phase.
    expect(event.ip).toBeNull();
    expect(event.device).toBeNull();
    expect(listAudit()).toHaveLength(before + 1);
    expect(listAudit()[0].id).toBe(event.id); // newest first
  });

  it("attributes to the current actor by default", () => {
    setCurrentActor({ id: "emp_001", name: "Amelia Rivera" });
    const event = recordAudit({ action: "settings_changed", target: "Invitation settings" })!;
    expect(event.actor).toBe("Amelia Rivera");
    expect(event.actorId).toBe("emp_001");
  });

  it("lets a failed login override the actor with the attempted email and no id", () => {
    setCurrentActor({ id: "emp_001", name: "Amelia Rivera" });
    const event = recordAudit({
      action: "failed_login",
      actor: "attacker@evil.dev",
      actorId: null,
      target: "attacker@evil.dev",
    })!;
    expect(event.actor).toBe("attacker@evil.dev");
    expect(event.actorId).toBeNull();
  });

  it("captures old and new values for changes", () => {
    const event = recordAudit({
      action: "role_changed",
      target: "Owen Lee",
      oldValue: "employee",
      newValue: "team_lead",
    })!;
    expect(event.oldValue).toBe("employee");
    expect(event.newValue).toBe("team_lead");
  });
});

describe("filterAudit", () => {
  it("filters by category, action, and free-text query", () => {
    __resetAudit();
    setCurrentActor({ id: "emp_001", name: "Amelia Rivera" });
    recordAudit({ action: "login", target: "amelia@spartaflow.dev" });
    recordAudit({ action: "employee_deleted", target: "Sam Gold" });
    recordAudit({ action: "project_deleted", target: "Legacy Migration" });

    const events = listAudit();
    const employeeOnly = filterAudit(events, { category: "employee" });
    expect(employeeOnly.length).toBeGreaterThan(0);
    expect(employeeOnly.every((e) => e.category === "employee")).toBe(true);

    const projectDeletes = filterAudit(events, { action: "project_deleted" });
    expect(projectDeletes.every((e) => e.action === "project_deleted")).toBe(true);
    expect(projectDeletes.map((e) => e.target)).toContain("Legacy Migration");

    expect(filterAudit(events, { query: "legacy migration" }).length).toBeGreaterThan(0);
    expect(filterAudit(events, { query: "nothing-matches" })).toHaveLength(0);
  });
});

describe("resilience", () => {
  it("every tracked action maps to a category", () => {
    for (const action of Object.keys(ACTION_CATEGORY)) {
      expect(ACTION_CATEGORY[action as keyof typeof ACTION_CATEGORY]).toBeTruthy();
    }
  });
});

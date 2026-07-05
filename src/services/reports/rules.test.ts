import { describe, expect, it } from "vitest";

import type { DependencyState } from "@/features/dependencies/types";
import {
  canCreateSubmission,
  isDependencyOpen,
  RESOLVED_DEPENDENCY_STATES,
  resolveSubmissionMode,
  resolvedAtFor,
  TERMINAL_DEPENDENCY_STATES,
} from "./rules";

describe("one submission per day (check-in / midday / eod)", () => {
  it("creates when none exists, updates when one already does", () => {
    expect(resolveSubmissionMode(null)).toBe("create");
    expect(resolveSubmissionMode(undefined)).toBe("create");
    expect(resolveSubmissionMode({ id: "abc" })).toBe("update");
  });

  it("only allows a brand-new submission when none exists yet", () => {
    expect(canCreateSubmission(null)).toBe(true);
    expect(canCreateSubmission({ id: "abc" })).toBe(false); // second submit edits, never duplicates
  });
});

describe("a dependency stays Open until resolved", () => {
  const openStates: DependencyState[] = ["draft", "pending", "accepted", "in_progress", "blocked"];
  const terminalStates: DependencyState[] = ["resolved", "closed", "cancelled", "rejected"];

  it("is Open in every non-terminal state", () => {
    for (const s of openStates) expect(isDependencyOpen(s)).toBe(true);
  });

  it("is not Open once it reaches a terminal state", () => {
    for (const s of terminalStates) expect(isDependencyOpen(s)).toBe(false);
  });

  it("exposes the terminal/resolved state sets", () => {
    expect([...TERMINAL_DEPENDENCY_STATES].sort()).toEqual(
      ["cancelled", "closed", "rejected", "resolved"].sort(),
    );
    expect([...RESOLVED_DEPENDENCY_STATES].sort()).toEqual(["closed", "resolved"].sort());
  });

  it("stamps resolved_at only on resolved/closed", () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    expect(resolvedAtFor("resolved", now)).toBe(now.toISOString());
    expect(resolvedAtFor("closed", now)).toBe(now.toISOString());
    expect(resolvedAtFor("in_progress", now)).toBeNull();
    expect(resolvedAtFor("blocked", now)).toBeNull();
    expect(resolvedAtFor("rejected", now)).toBeNull(); // rejected closes but isn't "resolved"
  });
});

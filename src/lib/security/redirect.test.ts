import { describe, expect, it } from "vitest";

import { toSafeInternalPath } from "./redirect";

// jsdom is not configured for this suite (node env), so window is undefined and
// only the origin-independent branches are exercised — which is exactly the SSR
// path where this must stay safe.
describe("toSafeInternalPath", () => {
  it("keeps same-origin bare paths", () => {
    expect(toSafeInternalPath("/app/tasks")).toBe("/app/tasks");
    expect(toSafeInternalPath("/app/tasks?x=1#h")).toBe("/app/tasks?x=1#h");
  });

  it("falls back for empty/undefined", () => {
    expect(toSafeInternalPath(undefined)).toBe("/app");
    expect(toSafeInternalPath("")).toBe("/app");
    expect(toSafeInternalPath(null)).toBe("/app");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(toSafeInternalPath("//evil.com")).toBe("/app");
    expect(toSafeInternalPath("/\\evil.com")).toBe("/app");
    expect(toSafeInternalPath("\\\\evil.com")).toBe("/app");
  });

  it("rejects absolute cross-origin URLs", () => {
    expect(toSafeInternalPath("https://evil.com/steal")).toBe("/app");
    expect(toSafeInternalPath("http://evil.com")).toBe("/app");
  });

  it("honors a custom fallback", () => {
    expect(toSafeInternalPath(undefined, "/auth")).toBe("/auth");
  });
});

import { describe, expect, it } from "vitest";

import { safeHref } from "./link-safety";

describe("safeHref", () => {
  it("allows http and https URLs", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("http://example.com/path?q=1")).toBe("http://example.com/path?q=1");
  });

  it("allows mailto links", () => {
    expect(safeHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
  });

  it("allows relative and in-page links", () => {
    expect(safeHref("/app/tasks")).toBe("/app/tasks");
    expect(safeHref("./sibling")).toBe("./sibling");
    expect(safeHref("#section")).toBe("#section");
    expect(safeHref("?tab=details")).toBe("?tab=details");
  });

  it("rejects javascript: URLs (including obfuscated/whitespace variants)", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("  javascript:alert(1)")).toBeNull();
    expect(safeHref("JavaScript:alert(1)")).toBeNull();
  });

  it("rejects data: and vbscript: URLs", () => {
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects unknown/dangerous absolute schemes", () => {
    expect(safeHref("ftp://example.com")).toBeNull();
    expect(safeHref("file:///etc/passwd")).toBeNull();
  });

  it("allows tel: links (no script execution surface)", () => {
    expect(safeHref("tel:+123456")).toBe("tel:+123456");
  });
});

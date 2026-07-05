import { describe, expect, it } from "vitest";

import { safeUrl, isSafeUrl } from "./url";

describe("safeUrl", () => {
  it("allows http(s), mailto and tel", () => {
    expect(safeUrl("https://example.com/x?y=1")).toBe("https://example.com/x?y=1");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
    expect(safeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeUrl("tel:+15551234")).toBe("tel:+15551234");
  });

  it("allows relative and in-page links", () => {
    expect(safeUrl("/app/tasks")).toBe("/app/tasks");
    expect(safeUrl("#top")).toBe("#top");
    expect(safeUrl("?q=1")).toBe("?q=1");
  });

  it("upgrades a bare domain to https", () => {
    expect(safeUrl("example.com/path")).toBe("https://example.com/path");
  });

  it("blocks javascript: including case and control-char obfuscation", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeUrl("  javascript:alert(1)")).toBeNull();
    expect(safeUrl("java\tscript:alert(1)")).toBeNull();
    expect(safeUrl("java\nscript:alert(1)")).toBeNull();
  });

  it("blocks data:, vbscript:, file: and unknown schemes", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
    expect(safeUrl("ftp://example.com")).toBeNull();
  });

  it("isSafeUrl mirrors safeUrl", () => {
    expect(isSafeUrl("https://ok.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });
});

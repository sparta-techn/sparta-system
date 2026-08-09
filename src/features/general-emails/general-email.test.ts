import { describe, expect, it } from "vitest";

import { isolateLatinRuns, renderGeneralEmail, type GeneralEmailInput } from "./general-email";

const base: GeneralEmailInput = {
  subject: "Office closed Thursday",
  bodyHtml: "<p>The office is closed on Thursday.</p>",
  employeeName: "Sara Hassan",
  company: { name: "Sparta Flow", supportEmail: "hr@spartaflow.com" },
};

const render = (overrides: Partial<GeneralEmailInput> = {}) =>
  renderGeneralEmail({ ...base, ...overrides });

describe("isolateLatinRuns", () => {
  it("wraps a Latin run inside Arabic text", () => {
    expect(isolateLatinRuns("مرحباً Sparta Flow اليوم")).toBe(
      'مرحباً <span dir="ltr">Sparta Flow</span> اليوم',
    );
  });

  it("keeps a URL whole rather than fragmenting it", () => {
    const result = isolateLatinRuns("راجع https://example.com/a_b للمزيد");
    expect(result).toContain('<span dir="ltr">https://example.com/a_b</span>');
  });

  it("never rewrites attributes inside tags", () => {
    const result = isolateLatinRuns('<a href="https://x.com" rel="noopener">رابط</a>');
    expect(result).toContain('<a href="https://x.com" rel="noopener">');
    expect(result).not.toContain('href="<span');
  });

  // Splitting `&amp;` into `&<span dir="ltr">amp</span>;` would turn a working
  // entity into visible garbage in every recipient's inbox.
  it("treats character references as atomic", () => {
    expect(isolateLatinRuns("شركة &amp; أخرى")).toBe("شركة &amp; أخرى");
    expect(isolateLatinRuns("&nbsp;نص")).toBe("&nbsp;نص");
  });

  it("leaves text with no Latin script untouched", () => {
    expect(isolateLatinRuns("مرحباً بالجميع")).toBe("مرحباً بالجميع");
  });
});

describe("renderGeneralEmail", () => {
  it("carries the subject, greeting and body", () => {
    const r = render();
    expect(r.subject).toBe("Office closed Thursday");
    expect(r.html).toContain("Office closed Thursday");
    expect(r.html).toContain("Sara");
    expect(r.html).toContain("The office is closed on Thursday.");
  });

  it("keeps the shared branded shell", () => {
    const r = render();
    expect(r.html).toContain("Sparta Flow");
    expect(r.html).toContain("Sent by Sparta Flow via SpartaFlow.");
  });

  it("escapes the subject, which is author-supplied", () => {
    const r = render({ subject: `<img src=x onerror=alert(1)>` });
    expect(r.html).not.toContain("<img src=x");
    expect(r.html).toContain("&lt;img src=x");
  });

  // An all-English body must not be peppered with pointless isolation spans.
  it("does not isolate anything when the body has no Arabic", () => {
    const r = render();
    expect(r.html).not.toContain('<span dir="ltr">The office');
  });

  it("isolates Latin runs when the body mixes scripts", () => {
    const r = render({ bodyHtml: "<p>سيتم الإغلاق يوم Thursday</p>" });
    expect(r.html).toContain('<span dir="ltr">Thursday</span>');
  });

  it("produces a readable plain-text fallback from the markup", () => {
    const r = render({ bodyHtml: "<p>Hello</p><ul><li>One</li><li>Two</li></ul>" });
    expect(r.text).toContain("Hello");
    expect(r.text).toContain("• One");
    expect(r.text).toContain("• Two");
    expect(r.text).not.toContain("<li>");
  });

  it("falls back to a reply-to-this-email line with no support address", () => {
    const r = render({ company: { name: "Sparta Flow" } });
    expect(r.html).toContain("just reply to this email");
  });
});

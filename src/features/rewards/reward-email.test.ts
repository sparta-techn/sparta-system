import { describe, expect, it } from "vitest";

import { renderRewardEmail, type RewardEmailInput } from "./reward-email";

const base: RewardEmailInput = {
  employeeName: "Sara Hassan",
  amount: 500,
  currency: "EGP",
  reason: null,
  company: { name: "Sparta Flow", supportEmail: "hr@spartaflow.com" },
};

const render = (overrides: Partial<RewardEmailInput> = {}) =>
  renderRewardEmail({ ...base, ...overrides });

describe("renderRewardEmail", () => {
  it("carries the amount, employee name and both languages", () => {
    const r = render();
    expect(r.subject).toContain("مكافأة");
    expect(r.subject).toContain("reward");
    expect(r.html).toContain("500.00 EGP");
    expect(r.html).toContain("Sara");
    expect(r.html).toContain("يسعدنا إبلاغك");
    expect(r.html).toContain("you've received a reward of");
    expect(r.text).toContain("مرحباً");
    expect(r.text).toContain("Hi Sara,");
  });

  it("LTR-isolates Latin runs inside the Arabic (RTL) body", () => {
    const r = render();
    // Latin brand name inside Arabic HTML must be direction-isolated…
    expect(r.html).toContain('<span dir="ltr">Sparta Flow</span>');
    // …and wrapped in LRI…PDI isolates in the plain-text fallback.
    expect(r.text).toContain("⁦Sparta Flow⁩");
    expect(r.text).toContain("⁦Sara⁩");
  });

  it("leaves Arabic-script names un-isolated", () => {
    const r = render({ employeeName: "سارة حسن", company: { name: "شركة سبارتا" } });
    expect(r.html).not.toContain('<span dir="ltr">شركة سبارتا</span>');
    expect(r.text).toContain("سارة،");
    expect(r.text).not.toContain("⁦سارة⁩");
  });

  it("includes the reason only when provided, direction-neutral", () => {
    const withReason = render({ reason: "Outstanding Q3 delivery" });
    expect(withReason.html).toContain("سبب المكافأة");
    expect(withReason.html).toContain('dir="auto"');
    expect(withReason.html).toContain("Outstanding Q3 delivery");
    expect(withReason.text).toContain("سبب المكافأة: Outstanding Q3 delivery");

    const without = render({ reason: "   " });
    expect(without.html).not.toContain("سبب المكافأة");
    expect(without.text).not.toContain("سبب المكافأة");
  });

  it("escapes HTML in user-controlled fields", () => {
    const r = render({ reason: `<img src=x onerror=alert(1)>`, employeeName: `<b>X</b>` });
    expect(r.html).not.toContain("<img src=x");
    expect(r.html).not.toContain("<b>X</b>");
    expect(r.html).toContain("&lt;img src=x");
  });

  it("does not say 'Sent by SpartaFlow via SpartaFlow'", () => {
    const r = render({ company: { name: "SpartaFlow" } });
    expect(r.text).toContain("Sent by SpartaFlow.");
    expect(r.text).not.toContain("via SpartaFlow");
  });
});

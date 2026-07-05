import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, securityHeaders } from "./headers";

describe("buildContentSecurityPolicy", () => {
  it("locks down framing, objects and base-uri", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it("scopes connect-src to the given Supabase origin (rest + wss)", () => {
    const csp = buildContentSecurityPolicy("https://abc.supabase.co");
    expect(csp).toContain("https://abc.supabase.co");
    expect(csp).toContain("wss://abc.supabase.co");
  });
});

describe("securityHeaders", () => {
  it("emits always-on hardening headers", () => {
    const h = securityHeaders({ isProduction: false });
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("uses Report-Only CSP unless enforcement is requested", () => {
    const reportOnly = securityHeaders({ isProduction: true });
    expect(reportOnly["Content-Security-Policy-Report-Only"]).toBeTruthy();
    expect(reportOnly["Content-Security-Policy"]).toBeUndefined();

    const enforced = securityHeaders({ isProduction: true, enforceCsp: true });
    expect(enforced["Content-Security-Policy"]).toBeTruthy();
    expect(enforced["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("adds HSTS and frame-deny only in production", () => {
    const dev = securityHeaders({ isProduction: false });
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
    expect(dev["X-Frame-Options"]).toBeUndefined();

    const prod = securityHeaders({ isProduction: true });
    expect(prod["Strict-Transport-Security"]).toContain("max-age=");
    expect(prod["X-Frame-Options"]).toBe("DENY");
  });
});

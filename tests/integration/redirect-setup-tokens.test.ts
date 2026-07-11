/**
 * Guards the security-critical routing decision in the root component: a Supabase
 * setup token (invite/signup/recovery) that lands on the wrong route must be
 * rerouted to the page that exchanges it explicitly — never silently consumed.
 *
 * Paired with `detectSessionInUrl: false` in the Supabase client, this is what
 * prevents a stray/misdelivered token from establishing a session on the
 * dashboard without the user completing password setup.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { redirectSetupTokens } from "@/features/auth/setup-token-redirect";

type FakeLocation = { pathname: string; search: string; hash: string };

/** Swap window.location for a stub with a sp-able replace(). */
function setLocation(loc: FakeLocation) {
  const replace = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...loc, replace },
  });
  return replace;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redirectSetupTokens", () => {
  it("reroutes an invite token that landed on the dashboard to accept-invitation", () => {
    const replace = setLocation({
      pathname: "/app",
      search: "",
      hash: "#access_token=abc&refresh_token=def&type=invite",
    });

    expect(redirectSetupTokens()).toBe(true);
    expect(replace).toHaveBeenCalledWith(
      "/auth/accept-invitation#access_token=abc&refresh_token=def&type=invite",
    );
  });

  it("reroutes a signup token to accept-invitation", () => {
    const replace = setLocation({
      pathname: "/",
      search: "",
      hash: "#access_token=abc&refresh_token=def&type=signup",
    });

    expect(redirectSetupTokens()).toBe(true);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/auth/accept-invitation"));
  });

  it("reroutes a recovery token to its own reset-password screen, not accept-invitation", () => {
    const replace = setLocation({
      pathname: "/app",
      search: "?token_hash=xyz&type=recovery",
      hash: "",
    });

    expect(redirectSetupTokens()).toBe(true);
    expect(replace).toHaveBeenCalledWith("/auth/reset-password?token_hash=xyz&type=recovery");
  });

  it("leaves an invite token already on the accept-invitation page alone", () => {
    const replace = setLocation({
      pathname: "/auth/accept-invitation",
      search: "",
      hash: "#access_token=abc&refresh_token=def&type=invite",
    });

    expect(redirectSetupTokens()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves a recovery token already on the reset-password page alone", () => {
    const replace = setLocation({
      pathname: "/auth/reset-password",
      search: "?token_hash=xyz&type=recovery",
      hash: "",
    });

    expect(redirectSetupTokens()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignores a token with an unknown type", () => {
    const replace = setLocation({
      pathname: "/app",
      search: "",
      hash: "#access_token=abc&type=magiclink",
    });

    expect(redirectSetupTokens()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignores a type param with no accompanying token (malformed link)", () => {
    const replace = setLocation({ pathname: "/app", search: "?type=invite", hash: "" });

    expect(redirectSetupTokens()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignores a normal route with no token at all", () => {
    const replace = setLocation({ pathname: "/app/projects", search: "?tab=board", hash: "" });

    expect(redirectSetupTokens()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});

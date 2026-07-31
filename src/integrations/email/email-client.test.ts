import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmailClient } from "./email-client";
import { IntegrationError } from "../services/errors";

const FROM = { address: "hr@spartaflow.com", name: "SpartaFlow HR" };
const ENDPOINT = "https://resend.test";

/** Stub `fetch` with a queue of responses, recording every call. */
function stubFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { status: 200, body: {} };
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const client = (extra: Record<string, unknown> = {}) =>
  new EmailClient({ apiKey: "re_test", from: FROM, endpoint: ENDPOINT, ...extra });

afterEach(() => vi.unstubAllGlobals());

describe("EmailClient.send", () => {
  it("posts a Resend payload and returns the message id", async () => {
    const calls = stubFetch([{ status: 200, body: { id: "msg_123" } }]);

    const result = await client().send("payroll", {
      to: [{ address: "employee@example.com" }],
      subject: "Your July 2026 salary has been paid",
      html: "<p>hi</p>",
      text: "hi",
      replyTo: { address: "sparta@spartaflow.com" },
    });

    expect(result.messageId).toBe("msg_123");
    expect(calls[0].url).toBe(`${ENDPOINT}/emails`);

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.from).toBe("SpartaFlow HR <hr@spartaflow.com>");
    expect(body.to).toEqual(["employee@example.com"]);
    expect(body.reply_to).toBe("sparta@spartaflow.com");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
  });

  it("forwards an idempotency key so a retry cannot mail twice", async () => {
    const calls = stubFetch([{ status: 200, body: { id: "msg_1" } }]);
    await client().send("payroll", {
      to: [{ address: "e@x.com" }],
      subject: "s",
      html: "<p/>",
      idempotencyKey: "payslip:emp:2026-07-01:2026-07-31:1",
    });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("payslip:emp:2026-07-01:2026-07-31:1");
  });

  it("treats a 2xx with no message id as a failure, not a success", async () => {
    stubFetch([{ status: 200, body: {} }]);
    await expect(
      client().send("payroll", { to: [{ address: "e@x.com" }], subject: "s", html: "<p/>" }),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("maps provider failures onto the integration error contract", async () => {
    stubFetch([{ status: 401, body: { message: "invalid key" } }]);
    await expect(
      client().send("payroll", { to: [{ address: "e@x.com" }], subject: "s", html: "<p/>" }),
    ).rejects.toMatchObject({ code: "unauthorized" });

    stubFetch([{ status: 429, body: { message: "slow down" } }]);
    await expect(
      client().send("payroll", { to: [{ address: "e@x.com" }], subject: "s", html: "<p/>" }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("refuses to send without a configured key", async () => {
    stubFetch([]);
    const bare = new EmailClient({ from: FROM, endpoint: ENDPOINT });
    await expect(
      bare.send("payroll", { to: [{ address: "e@x.com" }], subject: "s", html: "<p/>" }),
    ).rejects.toMatchObject({ code: "not_connected" });
  });
});

describe("EmailClient.verifySender", () => {
  it("reports a verified domain", async () => {
    stubFetch([{ status: 200, body: { data: [{ name: "spartaflow.com", status: "verified" }] } }]);
    const identity = await client().verifySender("payroll");
    expect(identity).toMatchObject({ domain: "spartaflow.com", known: true, verified: true });
  });

  it("distinguishes a pending domain from an unknown one", async () => {
    stubFetch([{ status: 200, body: { data: [{ name: "spartaflow.com", status: "pending" }] } }]);
    expect(await client().verifySender("payroll")).toMatchObject({
      known: true,
      verified: false,
      status: "pending",
    });

    stubFetch([{ status: 200, body: { data: [{ name: "other.com", status: "verified" }] } }]);
    expect(await client().verifySender("payroll")).toMatchObject({
      known: false,
      verified: false,
    });
  });
});

describe("ensureSenderVerified (pre-flight)", () => {
  // resend.server reads process.env, so import it fresh per test.
  async function loadPreflight() {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
    process.env.PAYROLL_EMAIL_FROM = "SpartaFlow HR <hr@spartaflow.com>";
    const mod = await import("./resend.server");
    mod.resetSenderVerification();
    return mod;
  }

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.PAYROLL_EMAIL_FROM;
  });

  it("passes when the domain is verified", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    stubFetch([{ status: 200, body: { data: [{ name: "spartaflow.com", status: "verified" }] } }]);
    await expect(ensureSenderVerified(client(), "payroll")).resolves.toBeUndefined();
  });

  it("BLOCKS the send when the domain is registered but not yet verified", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    stubFetch([{ status: 200, body: { data: [{ name: "spartaflow.com", status: "pending" }] } }]);
    await expect(ensureSenderVerified(client(), "payroll")).rejects.toThrow(
      /not verified.*status: pending/is,
    );
  });

  it("BLOCKS the send when the domain is unknown to Resend", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    stubFetch([{ status: 200, body: { data: [] } }]);
    await expect(ensureSenderVerified(client(), "payroll")).rejects.toThrow(
      /not set up in Resend/i,
    );
  });

  it("says plainly that nothing was sent or recorded when it blocks", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    stubFetch([{ status: 200, body: { data: [] } }]);
    await expect(ensureSenderVerified(client(), "payroll")).rejects.toThrow(
      /no payment was recorded/i,
    );
  });

  it("fails OPEN when the key cannot read /domains (send-only key)", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    stubFetch([{ status: 403, body: { message: "restricted key" } }]);
    // A valid sending key that lacks domain-read scope must not block payroll.
    await expect(ensureSenderVerified(client(), "payroll")).resolves.toBeUndefined();
  });

  it("fails OPEN when Resend is unreachable", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    await expect(ensureSenderVerified(client(), "payroll")).resolves.toBeUndefined();
  });

  it("still fails CLOSED when no sender/credential is configured at all", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    stubFetch([]);
    const bare = new EmailClient({ endpoint: ENDPOINT });
    await expect(ensureSenderVerified(bare, "payroll")).rejects.toBeInstanceOf(IntegrationError);
  });

  it("probes once and memoizes the success", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    const calls = stubFetch([
      { status: 200, body: { data: [{ name: "spartaflow.com", status: "verified" }] } },
      { status: 200, body: { data: [{ name: "spartaflow.com", status: "verified" }] } },
    ]);
    await ensureSenderVerified(client(), "payroll");
    await ensureSenderVerified(client(), "payroll");
    expect(calls).toHaveLength(1);
  });

  it("does NOT memoize a pending domain, so it re-checks until DNS lands", async () => {
    const { ensureSenderVerified } = await loadPreflight();
    stubFetch([
      { status: 200, body: { data: [{ name: "spartaflow.com", status: "pending" }] } },
      { status: 200, body: { data: [{ name: "spartaflow.com", status: "verified" }] } },
    ]);
    await expect(ensureSenderVerified(client(), "payroll")).rejects.toThrow();
    await expect(ensureSenderVerified(client(), "payroll")).resolves.toBeUndefined();
  });
});

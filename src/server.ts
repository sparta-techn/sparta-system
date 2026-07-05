import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { securityHeaders, shouldApplySecurityHeaders } from "./lib/security/headers";

/**
 * Merge hardening headers onto an outgoing response without clobbering anything
 * the handler already set. Best-effort: some runtimes return responses with
 * immutable headers, in which case we leave the response untouched.
 */
function withSecurityHeaders(response: Response): Response {
  if (!shouldApplySecurityHeaders(response)) return response;
  try {
    const headers = securityHeaders({
      isProduction: process.env.NODE_ENV === "production",
      supabaseUrl: process.env.SUPABASE_URL,
      enforceCsp: process.env.ENFORCE_CSP === "true",
    });
    for (const [key, value] of Object.entries(headers)) {
      if (!response.headers.has(key)) response.headers.set(key, value);
    }
  } catch {
    /* immutable headers — ship the response as-is */
  }
  return response;
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};

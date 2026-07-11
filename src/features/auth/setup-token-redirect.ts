/**
 * Where each Supabase setup-token type must be exchanged. Invite/signup complete
 * on the accept-invitation page (set password + profile); recovery stays on its
 * own distinct reset-password screen.
 */
const SETUP_DESTINATIONS: Record<string, string> = {
  invite: "/auth/accept-invitation",
  signup: "/auth/accept-invitation",
  recovery: "/auth/reset-password",
};

/**
 * Catch a setup token (invite/signup/recovery) that landed on the wrong route —
 * e.g. because the Supabase redirect allowlist fell back to the Site URL — and
 * forward it, hash intact, to the page that exchanges it. Meant to run
 * synchronously on first client render (see routes/__root.tsx). Combined with
 * `detectSessionInUrl: false` on the client, a stray token can never silently
 * establish a session; it only ever completes on its dedicated setup page.
 * Returns true when a redirect was triggered.
 */
export function redirectSetupTokens(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, hash, search } = window.location;

  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search);
  const type = params.get("type") ?? query.get("type");
  const hasToken =
    params.get("access_token") ?? params.get("token_hash") ?? query.get("token_hash");
  if (!type || !hasToken) return false;

  const dest = SETUP_DESTINATIONS[type];
  // Unknown type, or already on the right page (let it exchange the token).
  if (!dest || pathname === dest) return false;

  window.location.replace(`${dest}${search}${hash}`);
  return true;
}

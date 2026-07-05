/**
 * Map Supabase auth / network errors to friendly messages.
 * Avoid leaking which factor failed (account vs password) for unauthenticated flows.
 */
export function mapAuthError(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String((error as { message?: string })?.message ?? "");

  const lc = message.toLowerCase();

  if (!message) return "Something went wrong. Please try again.";
  if (lc.includes("failed to fetch") || lc.includes("network"))
    return "Network error. Check your connection and try again.";
  if (lc.includes("invalid login") || lc.includes("invalid credentials"))
    return "Incorrect email or password.";
  if (lc.includes("email not confirmed"))
    return "Please verify your email before signing in.";
  if (lc.includes("user not found"))
    return "Incorrect email or password.";
  if (lc.includes("user is banned") || lc.includes("disabled"))
    return "This account is disabled. Contact your administrator.";
  if (lc.includes("rate limit") || lc.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (lc.includes("signup is disabled") || lc.includes("signups not allowed"))
    return "Self-signup is disabled. Ask your administrator for an invitation.";
  if (lc.includes("password should") || lc.includes("weak password"))
    return "Password is too weak. Use 10+ chars with upper, lower, number, symbol.";
  if (lc.includes("pwned") || lc.includes("compromised"))
    return "This password has appeared in a known data breach. Choose a different one.";
  if (lc.includes("token") && lc.includes("expire"))
    return "This link has expired. Request a new one.";
  if (lc.includes("invalid token") || lc.includes("invalid or expired"))
    return "This link is invalid or has expired. Request a new one.";
  if (lc.includes("session") && lc.includes("expired"))
    return "Your session has expired. Please sign in again.";
  if (lc.includes("unauthorized") || lc.includes("not authorized"))
    return "You don't have permission to do that.";
  return message;
}

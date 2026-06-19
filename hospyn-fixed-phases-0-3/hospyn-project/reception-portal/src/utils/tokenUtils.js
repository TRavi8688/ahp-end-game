// reception-portal/src/utils/tokenUtils.js
// SEC-10 FIX: Client-side JWT expiry check.
//
// NOTE: After SEC-7 migration to httpOnly cookies this client-side check
// becomes a UX improvement (redirect to login before an API call fails)
// rather than a security gate — the server always validates tokens.
// Keep it in place to avoid the user seeing a 401 error mid-session.

/**
 * Decode a JWT payload without signature verification (base64 only).
 * This is safe because we are NOT trusting the payload for access control —
 * we just use it to detect expiry early and redirect to login proactively.
 */
export function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}

/**
 * Returns true if token is present and not expired.
 * Call this in your auth guard / route guard before any API call.
 */
export function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  // payload.exp is in seconds; Date.now() is milliseconds
  return payload.exp * 1000 > Date.now();
}

/**
 * Call on app load / route change.
 * With SEC-7 httpOnly cookies the token is not in localStorage,
 * so this utility can be used for short-lived session tokens stored
 * in memory (e.g. useContext) if needed.
 *
 * For the httpOnly cookie flow, the server will return 401 when the
 * cookie has expired; the axios interceptor in receptionApi.js handles
 * that by redirecting to /login.
 */
export function guardRoute(tokenFromMemory) {
  if (!isTokenValid(tokenFromMemory)) {
    // Clear any in-memory state
    window.location.href = "/login";
    return false;
  }
  return true;
}

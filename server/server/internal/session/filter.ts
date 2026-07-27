import type { SessionWithToken, SessionSearchTerms } from "./types";

/**
 * Checks if a session matches the given search criteria.
 *
 * @param session - The session to check
 * @param options - The search criteria to match against
 * @returns True if the session matches all criteria, false otherwise
 */
export function sessionMatchesFilter(
  session: SessionWithToken,
  options: SessionSearchTerms,
): boolean {
  if (
    options.userId &&
    session.authenticated &&
    session.authenticated.userId !== options.userId
  ) {
    return false;
  }

  if (options.oidc && session.oidc) {
    for (const [key, value] of Object.entries(options.oidc)) {
      if (
        JSON.stringify(
          (session.oidc as unknown as Record<string, unknown>)[key],
        ) !== JSON.stringify(value)
      ) {
        return false;
      }
    }
  }

  for (const [key, value] of Object.entries(options.data || {})) {
    if (JSON.stringify(session.data[key]) !== JSON.stringify(value)) {
      return false;
    }
  }

  return true;
}

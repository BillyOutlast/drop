import type { OIDCData, SessionWithToken, SessionSearchTerms } from "./types";

function matchesOidc(session: SessionWithToken, oidc: OIDCData): boolean {
  if (!session.oidc) {
    return false;
  }
  for (const [key, value] of Object.entries(oidc)) {
    if (
      JSON.stringify(
        (session.oidc as unknown as Record<string, unknown>)[key],
      ) !== JSON.stringify(value)
    ) {
      return false;
    }
  }
  return true;
}

function matchesData(
  session: SessionWithToken,
  data: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(data)) {
    if (JSON.stringify(session.data[key]) !== JSON.stringify(value)) {
      return false;
    }
  }
  return true;
}

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
  if (options.userId) {
    if (!session.authenticated?.userId) {
      return false;
    }
    if (session.authenticated.userId !== options.userId) {
      return false;
    }
  }

  if (options.oidc && !matchesOidc(session, options.oidc)) {
    return false;
  }

  if (options.data && !matchesData(session, options.data)) {
    return false;
  }

  return true;
}

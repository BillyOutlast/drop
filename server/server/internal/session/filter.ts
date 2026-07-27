import type { SessionWithToken, SessionSearchTerms } from "./types";

/**
 * Determines whether a session satisfies all provided search criteria.
 *
 * @param session - The session to evaluate
 * @param options - The search criteria to apply
 * @returns `true` if all specified criteria match the session, `false` otherwise
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

  if (options.oidc) {
    if (!session.oidc) {
      return false;
    }
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

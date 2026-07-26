/**
 * h3 route handler reference test — copy template for new auth route tests.
 *
 * Patterns demonstrated:
 * 1. vi.mock hoisting — mock internal modules (session, prisma, etc.) before
 *    importing the handler under test
 * 2. Spy on Nuxt-injected globals (sendRedirect, setCookie, etc.) declared
 *    in test/setup.ts
 * 3. createMockH3Event from test/utils/h3.ts — simulate a request with
 *    method, body, headers, cookies, router params, etc.
 * 4. Call the default export of a defineEventHandler route directly —
 *    setup.ts passes the handler through unchanged
 * 5. Assert on dependency calls and global invocations
 *
 * Key constraints:
 * - All vi.mock() calls must appear at module scope; vitest hoists them
 * - The SUT import must come after all vi.mock() calls, guarded with an
 *   eslint-disable-next-line import/first comment
 * - restore globalThis stubs in afterEach to avoid cross-test leakage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockH3Event } from "../../utils/h3";

// ---------------------------------------------------------------------------
// Module mocks — hoisted by vitest to the top of the file
// ---------------------------------------------------------------------------

const mockSignout = vi.fn();

vi.mock("../../../../server/server/internal/session", () => ({
  default: {
    signout: (...args: unknown[]) => mockSignout(...args),
  },
}));

// ---------------------------------------------------------------------------
// System-under-test import — must come after vi.mock()
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import signoutHandler from "../../../../server/server/routes/auth/signout.get";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auth/signout.get (route reference template)", () => {
  let originalSendRedirect: unknown;

  beforeEach(() => {
    vi.clearAllMocks();

    // Replace the setup.ts no-op stub with a spy so we can assert on calls
    originalSendRedirect = (globalThis as Record<string, unknown>).sendRedirect;
    (globalThis as Record<string, unknown>).sendRedirect = vi.fn();
  });

  afterEach(() => {
    // Restore the original stub to keep other tests isolated
    (globalThis as Record<string, unknown>).sendRedirect = originalSendRedirect;
  });

  it("calls sessionHandler.signout and redirects to /auth/signin", async () => {
    mockSignout.mockResolvedValueOnce(true);

    const event = createMockH3Event({ method: "GET" });
    await signoutHandler(event as never);

    expect(mockSignout).toHaveBeenCalledTimes(1);
    expect(mockSignout).toHaveBeenCalledWith(event);

    const redirectSpy = (globalThis as Record<string, unknown>)
      .sendRedirect as ReturnType<typeof vi.fn>;
    expect(redirectSpy).toHaveBeenCalledTimes(1);
    expect(redirectSpy).toHaveBeenCalledWith(event, "/auth/signin");
  });

  it("redirects to /auth/signin even when signout returns false", async () => {
    mockSignout.mockResolvedValueOnce(false);

    const event = createMockH3Event({ method: "GET" });
    await signoutHandler(event as never);

    const redirectSpy = (globalThis as Record<string, unknown>)
      .sendRedirect as ReturnType<typeof vi.fn>;
    expect(redirectSpy).toHaveBeenCalledWith(event, "/auth/signin");
  });

  it("passes the original H3 event mock through to dependencies", async () => {
    mockSignout.mockResolvedValueOnce(true);

    const event = createMockH3Event({
      method: "GET",
      headers: { "accept-language": "en" },
    });
    await signoutHandler(event as never);

    // Verify the exact same event reference is forwarded
    expect(mockSignout).toHaveBeenCalledWith(event);
  });
});

/**
 * OIDC Logout Test
 *
 * Tests the handleLogout() method of OIDCManager, covering:
 * - Invalid JWT verification (logger.error path)
 * - Invalid token structure (logger.error path)
 * - Missing sid and sub claims (logger.error path)
 * - Successful logout with sessions found
 *
 * Covers lines 511, 517-519, 523 in oidc/index.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks – hoisted by vitest before all imports
// ---------------------------------------------------------------------------

const mockJwtVerify = vi.fn();

vi.mock("jose", () => ({
  createRemoteJWKSet: () => vi.fn(),
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
}));

vi.mock("../../../../server/server/internal/db/database", () => ({
  default: {},
}));

vi.mock("../../../../server/server/internal/objects", () => ({
  default: {
    createFromSource: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../server/server/internal/config/sys-conf", () => ({
  systemConfig: {
    shouldOidcRequireHttps: () => false,
    getExternalUrl: () => "http://localhost:3000",
  },
}));

const mockSearchSessions = vi.fn().mockResolvedValue([]);
const mockSignoutByToken = vi.fn().mockResolvedValue(true);

vi.mock("../../../../server/server/internal/session", () => ({
  default: {
    searchSessions: (...args: unknown[]) => mockSearchSessions(...args),
    signoutByToken: (...args: unknown[]) => mockSignoutByToken(...args),
  },
  sessionHandler: {
    searchSessions: (...args: unknown[]) => mockSearchSessions(...args),
    signoutByToken: (...args: unknown[]) => mockSignoutByToken(...args),
  },
}));

vi.mock("jdenticon", () => ({
  toPng: () => Buffer.from(""),
}));

vi.mock("../../../../prisma/client/enums", () => ({
  AuthMec: { OpenID: "OpenID", Simple: "Simple" },
}));

const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock("../../../../server/server/internal/logging", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// SUT import
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first -- vi.mock() calls above are hoisted by vitest
import { OIDCManager } from "../../../../server/server/internal/auth/oidc/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManager(): OIDCManager {
  return new (
    OIDCManager as unknown as new (
      oidcConfiguration: {
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        userinfo_endpoint: string;
        jwks_uri: string;
        scopes_supported: string[];
      },
      clientId: string,
      clientSecret: string,
      externalUrl: URL,
    ) => OIDCManager
  )(
    {
      issuer: "https://mock-oidc.test",
      authorization_endpoint: "https://mock-oidc.test/auth",
      token_endpoint: "https://mock-oidc.test/token",
      userinfo_endpoint: "https://mock-oidc.test/userinfo",
      jwks_uri: "https://mock-oidc.test/jwks",
      scopes_supported: ["openid", "profile", "email"],
    },
    "mock-client-id",
    "mock-client-secret",
    new URL("http://localhost:3000"),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OIDC handleLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false and logs error when JWT verification fails", async () => {
    const manager = createManager();
    mockJwtVerify.mockRejectedValueOnce(new Error("Invalid token"));

    const result = await manager.handleLogout("invalid-jwt");

    expect(result).toBe(false);
    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Failed to verify OIDC logout token",
    );
  });

  it("returns false and logs error when token structure is invalid", async () => {
    const manager = createManager();
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: "https://mock-oidc.test",
        aud: "mock-client-id",
        iat: 1234567890,
        jti: "token-id",
        // Missing required 'events' field
      },
    });

    const result = await manager.handleLogout("valid-jwt-invalid-structure");

    expect(result).toBe(false);
    expect(mockLoggerError).toHaveBeenCalledWith(
      { summary: expect.any(String) },
      "Invalid OIDC logout token structure",
    );
  });

  it("returns false and logs error when both sid and sub are missing", async () => {
    const manager = createManager();
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: "https://mock-oidc.test",
        aud: "mock-client-id",
        iat: 1234567890,
        jti: "token-id",
        events: {
          "http://schemas.openid.net/event/backchannel-logout": {},
        },
        // Missing both sid and sub
      },
    });

    const result = await manager.handleLogout("valid-jwt-no-claims");

    expect(result).toBe(false);
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Invalid OIDC logout token: missing both 'sid' and 'sub' claims",
    );
  });

  it("returns true and signs out sessions when logout is successful", async () => {
    const manager = createManager();
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: "https://mock-oidc.test",
        sub: "user-123",
        aud: "mock-client-id",
        iat: 1234567890,
        jti: "token-id",
        events: {
          "http://schemas.openid.net/event/backchannel-logout": {},
        },
      },
    });

    mockSearchSessions.mockResolvedValueOnce([
      { token: "session-1" },
      { token: "session-2" },
    ]);

    const result = await manager.handleLogout("valid-jwt");

    expect(result).toBe(true);
    expect(mockSearchSessions).toHaveBeenCalledWith({
      oidc: {
        iss: "https://mock-oidc.test",
        sub: "user-123",
      },
    });
    expect(mockSignoutByToken).toHaveBeenCalledTimes(2);
    expect(mockSignoutByToken).toHaveBeenCalledWith("session-1");
    expect(mockSignoutByToken).toHaveBeenCalledWith("session-2");
  });

  it("searches sessions with sid when present", async () => {
    const manager = createManager();
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: "https://mock-oidc.test",
        sub: "user-123",
        sid: "session-abc",
        aud: "mock-client-id",
        iat: 1234567890,
        jti: "token-id",
        events: {
          "http://schemas.openid.net/event/backchannel-logout": {},
        },
      },
    });

    mockSearchSessions.mockResolvedValueOnce([]);

    const result = await manager.handleLogout("valid-jwt-with-sid");

    expect(result).toBe(true);
    expect(mockSearchSessions).toHaveBeenCalledWith({
      oidc: {
        iss: "https://mock-oidc.test",
        sub: "user-123",
        sid: "session-abc",
      },
    });
  });
});

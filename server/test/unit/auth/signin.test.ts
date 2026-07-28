// Unit test for POST /api/v1/auth/signin/simple.post.ts
//
// Tests handler logic in isolation: validation, DB lookup, password verification,
// auth-gate check, and session creation.  All external deps are mocked.

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest, evaluated before imports)
// ---------------------------------------------------------------------------

vi.mock("../../../server/internal/db/database", () => ({
  default: {
    linkedAuthMec: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../server/internal/session", () => ({
  default: {
    signin: vi.fn(),
  },
}));

vi.mock("../../../server/internal/auth", () => ({
  default: {
    getAuthProviders: vi.fn(),
  },
  checkHashArgon2: vi.fn(),
  checkHashBcrypt: vi.fn(),
}));

vi.mock("../../../server/internal/logging", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks so the mocks are active)
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import prisma from "../../../server/internal/db/database";
// eslint-disable-next-line import/first
import sessionHandler from "../../../server/internal/session";
// eslint-disable-next-line import/first
import authManager, {
  checkHashArgon2,
  checkHashBcrypt,
} from "../../../server/internal/auth";
// eslint-disable-next-line import/first
import handler from "../../../server/api/v1/auth/signin/simple.post";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal H3 event stub — handler never accesses properties directly. */
const mockH3 = {} as Parameters<typeof handler>[0];

let readBodyMock: ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Override the global readBody stub with a mock we control per-test
  readBodyMock = vi.fn().mockResolvedValue({});
  vi.stubGlobal("readBody", readBodyMock);

  // Stub useTranslation (auto-imported by @nuxtjs/i18n, not always available in test)
  vi.stubGlobal(
    "useTranslation",
    vi.fn(async () => (key: string) => key),
  );

  // Default: Simple auth enabled
  vi.mocked(authManager.getAuthProviders).mockReturnValue({
    Simple: true,
  } as ReturnType<typeof authManager.getAuthProviders>);
});

// ===========================================================================
// Tests
// ===========================================================================

describe("POST /api/v1/auth/signin/simple", () => {
  // -----------------------------------------------------------------------
  // Happy path: argon2
  // -----------------------------------------------------------------------
  it("valid signin with argon2 hash returns { result, userId }", async () => {
    readBodyMock.mockResolvedValue({
      username: "testuser",
      password: "correct-password",
    });

    vi.mocked(prisma.linkedAuthMec.findFirst).mockResolvedValue({
      id: "mec-1",
      mec: "Simple",
      enabled: true,
      version: 2,
      userId: "user-1",
      credentials: "valid-argon2-hash",
      user: { enabled: true },
    } as never);

    vi.mocked(checkHashArgon2).mockResolvedValue(true);
    vi.mocked(sessionHandler.signin).mockResolvedValue("signin");

    const result = await handler(mockH3);

    expect(result).toEqual({ userId: "user-1", result: "signin" });
    expect(sessionHandler.signin).toHaveBeenCalledWith(mockH3, "user-1", {
      rememberMe: false,
    });
  });

  // -----------------------------------------------------------------------
  // Happy path: legacy bcrypt
  // -----------------------------------------------------------------------
  it("legacy bcrypt signin (version=1) returns { result, userId }", async () => {
    readBodyMock.mockResolvedValue({
      username: "testuser",
      password: "correct-password",
    });

    vi.mocked(prisma.linkedAuthMec.findFirst).mockResolvedValue({
      id: "mec-1",
      mec: "Simple",
      enabled: true,
      version: 1,
      userId: "user-1",
      credentials: ["Simple", "valid-bcrypt-hash"],
      user: { enabled: true },
    } as never);

    vi.mocked(checkHashBcrypt).mockResolvedValue(true);
    vi.mocked(sessionHandler.signin).mockResolvedValue("signin");

    const result = await handler(mockH3);

    expect(result).toEqual({ result: "signin", userId: "user-1" });
    expect(sessionHandler.signin).toHaveBeenCalledWith(mockH3, "user-1", {
      rememberMe: false,
    });
  });

  // -----------------------------------------------------------------------
  // Error: disabled user
  // -----------------------------------------------------------------------
  it("disabled user throws 403", async () => {
    readBodyMock.mockResolvedValue({
      username: "disabled-user",
      password: "any-password",
    });

    vi.mocked(prisma.linkedAuthMec.findFirst).mockResolvedValue({
      id: "mec-1",
      mec: "Simple",
      enabled: true,
      version: 2,
      userId: "user-1",
      credentials: "some-hash",
      user: { enabled: false },
    } as never);

    await expect(handler(mockH3)).rejects.toMatchObject({ statusCode: 403 });
  });

  // -----------------------------------------------------------------------
  // Error: invalid password
  // -----------------------------------------------------------------------
  it("invalid password throws 401", async () => {
    readBodyMock.mockResolvedValue({
      username: "testuser",
      password: "wrong-password",
    });

    vi.mocked(prisma.linkedAuthMec.findFirst).mockResolvedValue({
      id: "mec-1",
      mec: "Simple",
      enabled: true,
      version: 2,
      userId: "user-1",
      credentials: "valid-argon2-hash",
      user: { enabled: true },
    } as never);

    vi.mocked(checkHashArgon2).mockResolvedValue(false);

    await expect(handler(mockH3)).rejects.toMatchObject({ statusCode: 401 });
  });

  // -----------------------------------------------------------------------
  // Error: nonexistent user
  // -----------------------------------------------------------------------
  it("nonexistent user throws 401", async () => {
    readBodyMock.mockResolvedValue({
      username: "ghost",
      password: "any-password",
    });

    vi.mocked(prisma.linkedAuthMec.findFirst).mockResolvedValue(null);

    await expect(handler(mockH3)).rejects.toMatchObject({ statusCode: 401 });
  });

  // -----------------------------------------------------------------------
  // Error: Simple auth disabled
  // -----------------------------------------------------------------------
  it("Simple auth disabled throws 403", async () => {
    readBodyMock.mockResolvedValue({
      username: "testuser",
      password: "correct-password",
    });

    vi.mocked(authManager.getAuthProviders).mockReturnValue({
      Simple: false,
    } as ReturnType<typeof authManager.getAuthProviders>);

    await expect(handler(mockH3)).rejects.toMatchObject({ statusCode: 403 });
  });

  // -----------------------------------------------------------------------
  // Error: invalid body (missing username)
  // -----------------------------------------------------------------------
  it("invalid body (missing username) throws 400", async () => {
    // No username — arktype validation fails
    readBodyMock.mockResolvedValue({
      password: "some-password",
    });

    await expect(handler(mockH3)).rejects.toMatchObject({ statusCode: 400 });
  });

  // -----------------------------------------------------------------------
  // rememberMe behavior
  // -----------------------------------------------------------------------
  it("rememberMe=true passes to sessionHandler.signin", async () => {
    readBodyMock.mockResolvedValue({
      username: "testuser",
      password: "correct-password",
      rememberMe: true,
    });

    vi.mocked(prisma.linkedAuthMec.findFirst).mockResolvedValue({
      id: "mec-1",
      mec: "Simple",
      enabled: true,
      version: 2,
      userId: "user-1",
      credentials: "valid-argon2-hash",
      user: { enabled: true },
    } as never);

    vi.mocked(checkHashArgon2).mockResolvedValue(true);
    vi.mocked(sessionHandler.signin).mockResolvedValue("signin");

    await handler(mockH3);

    expect(sessionHandler.signin).toHaveBeenCalledWith(mockH3, "user-1", {
      rememberMe: true,
    });
  });
});

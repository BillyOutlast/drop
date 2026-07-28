import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../server/internal/session/db", () => ({
  default: () => ({
    getSession: vi.fn(),
    setSession: vi.fn(),
    removeSession: vi.fn(),
    findSessions: vi.fn(),
    updateSession: vi.fn(),
    cleanupSessions: vi.fn(),
    getNumberActiveSessions: vi.fn(),
  }),
}));

vi.mock("../../../server/internal/db/database", () => ({
  default: {
    linkedMFAMec: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// eslint-disable-next-line import/first
import sessionHandler from "../../../server/internal/session";

describe("Session Cookie Security Attributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("setCookie", vi.fn());
    vi.stubGlobal("getRequestURL", vi.fn());
    vi.stubGlobal("createError", (opts: unknown) => {
      throw opts;
    });
    vi.stubGlobal("deleteCookie", vi.fn());
  });

  it("sets secure flag for HTTPS requests", async () => {
    vi.mocked(vi.mocked(getRequestURL)).mockReturnValue(
      new URL("https://drop.example.com"),
    );

    await sessionHandler.signin(
      {
        headers: new Map([["Cookie", "drop-token=old-token"]]),
      } as never,
      "user-1",
    );

    expect(setCookie).toHaveBeenCalledWith(
      expect.anything(),
      "drop-token",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("unsets secure flag for HTTP requests", async () => {
    vi.mocked(vi.mocked(getRequestURL)).mockReturnValue(
      new URL("http://drop.example.com"),
    );

    await sessionHandler.signin(
      {
        headers: new Map([["Cookie", "drop-token=old-token"]]),
      } as never,
      "user-1",
    );

    expect(setCookie).toHaveBeenCalledWith(
      expect.anything(),
      "drop-token",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("includes all required security attributes", async () => {
    vi.mocked(vi.mocked(getRequestURL)).mockReturnValue(
      new URL("https://drop.example.com"),
    );

    await sessionHandler.signin(
      {
        headers: new Map([["Cookie", "drop-token=old-token"]]),
      } as never,
      "user-1",
    );

    expect(setCookie).toHaveBeenCalledWith(
      expect.anything(),
      "drop-token",
      expect.any(String),
      expect.objectContaining({
        expires: expect.any(Date),
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("sets lax sameSite to prevent CSRF", async () => {
    vi.mocked(vi.mocked(getRequestURL)).mockReturnValue(
      new URL("https://drop.example.com"),
    );

    await sessionHandler.signin(
      {
        headers: new Map([["Cookie", "drop-token=old-token"]]),
      } as never,
      "user-1",
    );

    expect(setCookie).toHaveBeenCalledWith(
      expect.anything(),
      "drop-token",
      expect.any(String),
      expect.objectContaining({
        sameSite: "lax",
      }),
    );
  });
});

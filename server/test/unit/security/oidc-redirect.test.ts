import { describe, expect, it, vi, beforeEach } from "vitest";
import authManager from "../../../server/internal/auth";
import sessionHandler from "../../../server/internal/session";

vi.mock("../../../server/internal/auth", () => ({
  default: {
    getAuthProviders: vi.fn(),
  },
}));

vi.mock("../../../server/internal/session", () => ({
  default: {
    signin: vi.fn(),
  },
}));

vi.mock("../../../server/internal/userstats", () => ({
  default: {
    cacheUserSessions: vi.fn(),
  },
}));

describe("OIDC Redirect Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("setHeader", vi.fn());
    vi.stubGlobal("sendRedirect", vi.fn());
    vi.stubGlobal("getQuery", vi.fn());
    vi.stubGlobal("getRequestURL", vi.fn());
    vi.stubGlobal("createError", (opts: unknown) => {
      throw opts;
    });

    vi.mocked(authManager.getAuthProviders).mockReturnValue({
      Simple: false,
      OpenID: {
        authorize: vi.fn(),
      } as unknown as never,
    });
  });

  it("allows same-origin redirect", async () => {
    vi.mocked(sessionHandler.signin).mockResolvedValue("signin");
    vi.mocked(authManager.getAuthProviders).mockReturnValue({
      Simple: false,
      OpenID: {
        authorize: vi.fn().mockResolvedValue({
          user: { id: "user-1" },
          options: { redirect: "/dashboard" },
          claims: {},
        }),
      } as unknown as never,
    });
    vi.mocked(vi.mocked(getQuery)).mockReturnValue({
      code: "valid-code",
      state: "valid-state",
    });
    vi.mocked(vi.mocked(getRequestURL)).mockReturnValue(
      new URL("https://drop.example.com/auth/oidc/callback"),
    );

    const handler = (
      await import("../../../server/api/v1/auth/oidc/callback.get")
    ).default;
    await handler({} as never);

    expect(sendRedirect).toHaveBeenCalledWith(expect.anything(), "/dashboard");
  });

  it("rejects cross-origin redirect", async () => {
    vi.mocked(sessionHandler.signin).mockResolvedValue("signin");
    vi.mocked(authManager.getAuthProviders).mockReturnValue({
      Simple: false,
      OpenID: {
        authorize: vi.fn().mockResolvedValue({
          user: { id: "user-1" },
          options: { redirect: "https://evil.com/steal" },
          claims: {},
        }),
      } as unknown as never,
    });
    vi.mocked(vi.mocked(getQuery)).mockReturnValue({
      code: "valid-code",
      state: "valid-state",
    });
    vi.mocked(vi.mocked(getRequestURL)).mockReturnValue(
      new URL("https://drop.example.com/auth/oidc/callback"),
    );

    const handler = (
      await import("../../../server/api/v1/auth/oidc/callback.get")
    ).default;
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects missing code", async () => {
    vi.mocked(vi.mocked(getQuery)).mockReturnValue({
      state: "valid-state",
    });

    const handler = (
      await import("../../../server/api/v1/auth/oidc/callback.get")
    ).default;
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects missing state", async () => {
    vi.mocked(vi.mocked(getQuery)).mockReturnValue({
      code: "valid-code",
    });

    const handler = (
      await import("../../../server/api/v1/auth/oidc/callback.get")
    ).default;
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("handles localhost origin redirect correctly", async () => {
    vi.mocked(sessionHandler.signin).mockResolvedValue("signin");
    vi.mocked(authManager.getAuthProviders).mockReturnValue({
      Simple: false,
      OpenID: {
        authorize: vi.fn().mockResolvedValue({
          user: { id: "user-1" },
          options: { redirect: "/signin" },
          claims: {},
        }),
      } as unknown as never,
    });
    vi.mocked(vi.mocked(getQuery)).mockReturnValue({
      code: "valid-code",
      state: "valid-state",
    });
    vi.mocked(vi.mocked(getRequestURL)).mockReturnValue(
      new URL("http://localhost:3000/auth/oidc/callback"),
    );

    const handler = (
      await import("../../../server/api/v1/auth/oidc/callback.get")
    ).default;
    await handler({} as never);

    expect(sendRedirect).toHaveBeenCalledWith(expect.anything(), "/signin");
  });
});

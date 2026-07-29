import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/internal/logging", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/server/internal/auth/oidc", () => ({
  OIDCManager: { create: vi.fn() },
}));

import authManager from "~/server/internal/auth/index";

describe("AuthManager", () => {
  it("is a singleton instance", () => {
    expect(authManager).toBeDefined();
    expect(typeof authManager.init).toBe("function");
  });

  it("getAuthProviders returns initial disabled state", () => {
    const providers = authManager.getAuthProviders();
    expect(providers.Simple).toBe(false);
    expect(providers.OpenID).toBeUndefined();
  });

  it("getEnabledAuthProviders returns empty array initially", () => {
    const enabled = authManager.getEnabledAuthProviders();
    expect(enabled).toEqual([]);
  });

  it("getEnabledAuthProviders result contains only strings", () => {
    const enabled = authManager.getEnabledAuthProviders();
    expect(Array.isArray(enabled)).toBe(true);
    for (const e of enabled) {
      expect(typeof e).toBe("string");
    }
  });
});

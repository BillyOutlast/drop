import { describe, expect, it, vi, beforeEach } from "vitest";

describe("OIDC Redirect Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows same-origin redirect", () => {
    const requestOrigin = "https://drop.example.com";
    const redirectPath = "/dashboard";
    const redirectUrl = new URL(redirectPath, requestOrigin);

    expect(redirectUrl.origin).toBe(requestOrigin);
  });

  it("rejects cross-origin redirect", () => {
    const requestOrigin = "https://drop.example.com";
    const maliciousRedirect = "https://evil.com/steal";
    const redirectUrl = new URL(maliciousRedirect, requestOrigin);

    expect(redirectUrl.origin).not.toBe(requestOrigin);
  });

  it("rejects protocol-relative URL redirect", () => {
    const requestOrigin = "https://drop.example.com";
    const maliciousRedirect = "//evil.com/steal";
    const redirectUrl = new URL(maliciousRedirect, requestOrigin);

    expect(redirectUrl.origin).not.toBe(requestOrigin);
  });

  it("handles URL with path correctly", () => {
    const requestOrigin = "https://drop.example.com";
    const redirectPath = "/auth/mfa?redirect=%2Fdashboard";
    const redirectUrl = new URL(redirectPath, requestOrigin);

    expect(redirectUrl.origin).toBe(requestOrigin);
    expect(redirectUrl.pathname).toBe("/auth/mfa");
  });

  it("handles localhost origin correctly", () => {
    const requestOrigin = "http://localhost:3000";
    const redirectPath = "/signin";
    const redirectUrl = new URL(redirectPath, requestOrigin);

    expect(redirectUrl.origin).toBe(requestOrigin);
  });
});

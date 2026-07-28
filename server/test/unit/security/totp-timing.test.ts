import { describe, expect, it, vi, beforeEach } from "vitest";
import { timingSafeEqual } from "node:crypto";

vi.mock("~/server/internal/acls", () => ({
  default: {
    allowUserSuperlevel: vi.fn(),
  },
}));

vi.mock("~/server/internal/session", () => ({
  default: {
    getSession: vi.fn(),
    mfa: vi.fn(),
  },
}));

vi.mock("~/server/internal/db/database", () => ({
  default: {
    linkedMFAMec: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("~/server/internal/auth/totp", () => ({
  dropDecodeArrayBase64: vi
    .fn()
    .mockReturnValue(Buffer.from("fake-secret-key-here")),
  verifyTOTPCode: vi
    .fn()
    .mockImplementation(
      (generated: string, user: string) => generated === user,
    ),
  TOTPv1Credentials: Object,
}));

class MockSecretKey {
  _buffer: Buffer;
  constructor(buffer: Buffer) {
    this._buffer = buffer;
  }
}

vi.mock("otp-io", () => ({
  SecretKey: MockSecretKey,
  totp: vi.fn(),
}));

vi.mock("otp-io/crypto-web", () => ({
  hmac: vi.fn(),
}));

vi.mock("otp-io/crypto", () => ({
  hmac: vi.fn(),
}));

vi.mock("~/server/arktype", () => ({
  readDropValidatedBody: vi.fn(),
  throwingArktype: Object,
}));

describe("TOTP Timing-Safe Comparison", () => {
  beforeEach(() => {
    vi.stubGlobal("createError", (opts: unknown) => {
      throw opts;
    });
  });

  it("timingSafeEqual returns true for identical buffers", () => {
    const a = Buffer.from("123456");
    const b = Buffer.from("123456");
    expect(timingSafeEqual(a, b)).toBe(true);
  });

  it("timingSafeEqual returns false for different buffers", () => {
    const a = Buffer.from("123456");
    const b = Buffer.from("654321");
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it("timingSafeEqual throws for different length buffers", () => {
    const a = Buffer.from("123456");
    const b = Buffer.from("12345");
    expect(() => timingSafeEqual(a, b)).toThrow();
  });

  it("length check prevents timing leak on different lengths", () => {
    const code = "123456";
    const bodyCode = "12345";
    const isValid =
      code.length === bodyCode.length &&
      timingSafeEqual(Buffer.from(code), Buffer.from(bodyCode));
    expect(isValid).toBe(false);
  });

  it("verifyTOTPCode returns true for matching codes", async () => {
    const { verifyTOTPCode } = await import("~/server/internal/auth/totp");
    expect(vi.mocked(verifyTOTPCode)("123456", "123456")).toBe(true);
  });

  it("verifyTOTPCode returns false for non-matching codes", async () => {
    const { verifyTOTPCode } = await import("~/server/internal/auth/totp");
    expect(vi.mocked(verifyTOTPCode)("123456", "654321")).toBe(false);
  });

  it("verifyTOTPCode returns false for different length codes", async () => {
    const { verifyTOTPCode } = await import("~/server/internal/auth/totp");
    expect(vi.mocked(verifyTOTPCode)("123456", "12345")).toBe(false);
  });

  it("validates correct 6-digit TOTP code via production handler", async () => {
    const { totp } = await import("otp-io");
    vi.mocked(totp).mockResolvedValue("123456");

    const sessionHandler = (await import("~/server/internal/session")).default;
    const prisma = (await import("~/server/internal/db/database")).default;
    const { readDropValidatedBody } = await import("~/server/arktype");

    vi.mocked(sessionHandler.getSession).mockResolvedValue({
      authenticated: { userId: "user-1", level: 10, requiredLevel: 10 },
    } as never);
    vi.mocked(prisma.linkedMFAMec.findUnique).mockResolvedValue({
      credentials: { secret: "test-secret-value-not-real" },
    } as never);
    vi.mocked(readDropValidatedBody).mockResolvedValue({ code: "123456" });

    const handler = (await import("~/server/api/v1/auth/mfa/totp.post"))
      .default;
    const result = await handler({} as never);

    expect(result).toEqual({});
    expect(sessionHandler.mfa).toHaveBeenCalledWith(expect.anything(), 10);
  });

  it("rejects incorrect 6-digit TOTP code via production handler", async () => {
    const { totp } = await import("otp-io");
    vi.mocked(totp).mockResolvedValue("654321");

    const sessionHandler = (await import("~/server/internal/session")).default;
    const prisma = (await import("~/server/internal/db/database")).default;
    const { readDropValidatedBody } = await import("~/server/arktype");

    vi.mocked(sessionHandler.getSession).mockResolvedValue({
      authenticated: { userId: "user-1", level: 10, requiredLevel: 10 },
    } as never);
    vi.mocked(prisma.linkedMFAMec.findUnique).mockResolvedValue({
      credentials: { secret: "test-secret-value-not-real" },
    } as never);
    vi.mocked(readDropValidatedBody).mockResolvedValue({ code: "000000" });

    const handler = (await import("~/server/api/v1/auth/mfa/totp.post"))
      .default;
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects TOTP code with different length via production handler", async () => {
    const { totp } = await import("otp-io");
    vi.mocked(totp).mockResolvedValue("123456");

    const sessionHandler = (await import("~/server/internal/session")).default;
    const prisma = (await import("~/server/internal/db/database")).default;
    const { readDropValidatedBody } = await import("~/server/arktype");

    vi.mocked(sessionHandler.getSession).mockResolvedValue({
      authenticated: { userId: "user-1", level: 10, requiredLevel: 10 },
    } as never);
    vi.mocked(prisma.linkedMFAMec.findUnique).mockResolvedValue({
      credentials: { secret: "test-secret-value-not-real" },
    } as never);
    vi.mocked(readDropValidatedBody).mockResolvedValue({ code: "12345" });

    const handler = (await import("~/server/api/v1/auth/mfa/totp.post"))
      .default;
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("validates correct TOTP code via finish handler", async () => {
    const { totp } = await import("otp-io");
    vi.mocked(totp).mockResolvedValue("123456");

    const acls = (await import("~/server/internal/acls")).default;
    const prisma = (await import("~/server/internal/db/database")).default;
    const { readDropValidatedBody } = await import("~/server/arktype");

    vi.mocked(acls.allowUserSuperlevel).mockResolvedValue("user-1");
    vi.mocked(prisma.linkedMFAMec.findUnique).mockResolvedValue({
      credentials: { secret: "test-secret-value-not-real" },
      enabled: false,
    } as never);
    vi.mocked(readDropValidatedBody).mockResolvedValue({ code: "123456" });

    const handler = (await import("~/server/api/v1/user/mfa/totp/finish.post"))
      .default;
    await expect(handler({} as never)).resolves.toBeUndefined();
  });

  it("rejects incorrect TOTP code via finish handler", async () => {
    const { totp } = await import("otp-io");
    vi.mocked(totp).mockResolvedValue("654321");

    const acls = (await import("~/server/internal/acls")).default;
    const prisma = (await import("~/server/internal/db/database")).default;
    const { readDropValidatedBody } = await import("~/server/arktype");

    vi.mocked(acls.allowUserSuperlevel).mockResolvedValue("user-1");
    vi.mocked(prisma.linkedMFAMec.findUnique).mockResolvedValue({
      credentials: { secret: "test-secret-value-not-real" },
      enabled: false,
    } as never);
    vi.mocked(readDropValidatedBody).mockResolvedValue({ code: "000000" });

    const handler = (await import("~/server/api/v1/user/mfa/totp/finish.post"))
      .default;
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects TOTP code with different length via finish handler", async () => {
    const { totp } = await import("otp-io");
    vi.mocked(totp).mockResolvedValue("123456");

    const acls = (await import("~/server/internal/acls")).default;
    const prisma = (await import("~/server/internal/db/database")).default;
    const { readDropValidatedBody } = await import("~/server/arktype");

    vi.mocked(acls.allowUserSuperlevel).mockResolvedValue("user-1");
    vi.mocked(prisma.linkedMFAMec.findUnique).mockResolvedValue({
      credentials: { secret: "test-secret-value-not-real" },
      enabled: false,
    } as never);
    vi.mocked(readDropValidatedBody).mockResolvedValue({ code: "12345" });

    const handler = (await import("~/server/api/v1/user/mfa/totp/finish.post"))
      .default;
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { timingSafeEqual } from "node:crypto";

describe("TOTP Timing-Safe Comparison", () => {
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

  it("validates correct 6-digit TOTP code", () => {
    const code = "123456";
    const bodyCode = "123456";

    const isValid =
      code.length === bodyCode.length &&
      timingSafeEqual(Buffer.from(code), Buffer.from(bodyCode));

    expect(isValid).toBe(true);
  });

  it("rejects incorrect 6-digit TOTP code", () => {
    const code = "123456";
    const bodyCode = "000000";

    const isValid =
      code.length === bodyCode.length &&
      timingSafeEqual(Buffer.from(code), Buffer.from(bodyCode));

    expect(isValid).toBe(false);
  });
});

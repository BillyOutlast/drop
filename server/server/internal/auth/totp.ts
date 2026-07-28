import { timingSafeEqual } from "node:crypto";

export function dropEncodeArrayBase64(secret: Uint8Array): string {
  return encode(secret);
}
export function dropDecodeArrayBase64(secret: string): Uint8Array {
  return decode(secret);
}

const { fromCharCode } = String;
const encode = (uint8array: Uint8Array) => {
  const output = [];
  for (let i = 0, { length } = uint8array; i < length; i++)
    output.push(fromCharCode(uint8array[i] as number));
  return btoa(output.join(""));
};

const asCharCode = (c: string) => c.charCodeAt(0);

const decode = (chars: string) => Uint8Array.from(atob(chars), asCharCode);

export interface TOTPv1Credentials {
  secret: string;
}

/**
 * Compares a generated TOTP code against a user-supplied code using
 * timing-safe comparison to prevent timing attacks.
 *
 * Both codes are compared as UTF-8 Buffers. Length mismatch is checked
 * before the crypto comparison to avoid leaking information via
 * timingSafeEqual's length validation.
 *
 * @param generatedCode - The code generated server-side via the TOTP algorithm.
 * @param userCode - The code supplied by the user in the request body.
 * @returns True when the codes match, false otherwise.
 */
export function verifyTOTPCode(
  generatedCode: string,
  userCode: string,
): boolean {
  const codeBuffer = Buffer.from(generatedCode, "utf8");
  const bodyCodeBuffer = Buffer.from(userCode, "utf8");
  if (codeBuffer.length !== bodyCodeBuffer.length) return false;
  return timingSafeEqual(codeBuffer, bodyCodeBuffer);
}

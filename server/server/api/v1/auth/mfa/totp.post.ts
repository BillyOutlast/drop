import sessionHandler from "~/server/internal/session";
import {
  dropDecodeArrayBase64,
  verifyTOTPCode,
} from "~/server/internal/auth/totp";
import type { TOTPv1Credentials } from "~/server/internal/auth/totp";
import { type } from "arktype";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/client";
import { SecretKey, totp } from "otp-io";
import { hmac } from "otp-io/crypto-web";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";

const TOTPBody = type({
  code: "string",
}).configure(throwingArktype);

// fallow-ignore-next-line unused-export
export default defineEventHandler(async (h3) => {
  const session = await sessionHandler.getSession(h3);
  if (!session?.authenticated || session.authenticated?.level === 0)
    throw createError({
      statusCode: 403,
      message: "Sign in before completing MFA",
    });

  const body = await readDropValidatedBody(h3, TOTPBody);

  const linkedMFAMec = await prisma.linkedMFAMec.findUnique({
    where: {
      userId_mec: {
        userId: session.authenticated.userId,
        mec: MFAMec.TOTP,
      },
    },
  });
  if (!linkedMFAMec)
    throw createError({ statusCode: 400, message: "TOTP not enabled" });

  // fallow-ignore-next-line code-duplication
  const secret = (linkedMFAMec.credentials as unknown as TOTPv1Credentials)
    .secret;
  const secretKeyBuffer = dropDecodeArrayBase64(secret);
  const secretKey = new SecretKey(secretKeyBuffer);

  const code = await totp(hmac, { secret: secretKey });
  if (!verifyTOTPCode(code, body.code))
    throw createError({ statusCode: 403, message: "Invalid TOTP code." });

  await sessionHandler.mfa(h3, 10);

  return {};
});

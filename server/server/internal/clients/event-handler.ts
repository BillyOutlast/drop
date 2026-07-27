import type { ClientModel, UserModel } from "~/prisma/client/models";
import type { EventHandlerRequest, H3Event } from "h3";
import prisma from "../db/database";
import { useCertificateAuthority } from "~/server/plugins/ca";
import { logger } from "../logging";
import * as jose from "jose";

export type EventHandlerFunction<T> = (
  h3: H3Event<EventHandlerRequest>,
  utils: ClientUtils,
) => Promise<T> | T;

type ClientUtils = {
  clientId: string;
  fetchClient: () => Promise<ClientModel>;
  fetchUser: () => Promise<UserModel>;
};

const JWT_TIME_WIGGLE_SECONDS = 30;

/**
 * Wraps a client-authenticated event handler with JWT validation.
 *
 * Extracts a JWT from the Authorization header, validates the signature
 * against the client's X.509 certificate, and provides the caller with
 * utility functions for fetching the client and its owning user.
 *
 * @param handler - The handler function receiving the H3 event and client utils.
 * @returns An H3 event handler with client authentication middleware applied.
 */
export function defineClientEventHandler<T>(handler: EventHandlerFunction<T>) {
  return defineEventHandler(async (h3) => {
    const header = getHeader(h3, "Authorization");
    if (!header) throw createError({ statusCode: 403 });
    const [method, ...parts] = header.split(" ");

    let clientId: string;
    switch (method) {
      case "JWT": {
        clientId = parts[0] ?? "";
        const jwtToken = parts[1];

        if (!clientId || !jwtToken) throw createError({ statusCode: 403 });

        const certificateAuthority = useCertificateAuthority();
        const certBundle =
          await certificateAuthority.fetchClientCertificate(clientId);
        // This does the blacklist check already
        if (!certBundle)
          throw createError({
            statusCode: 403,
            message: "Invalid client ID",
          });

        let publicKey: jose.CryptoKey;
        try {
          publicKey = await jose.importX509(certBundle.cert, "ES384");
        } catch (err) {
          logger.warn(
            { err, clientId },
            "failed to import client certificate SPKI",
          );
          throw createError({
            statusCode: 403,
            message: "Invalid client certificate",
          });
        }

        const valid = await jose
          .jwtVerify(jwtToken, publicKey, {
            algorithms: ["ES384"],
            clockTolerance: JWT_TIME_WIGGLE_SECONDS,
          })
          .catch((err) => {
            logger.debug({ err, clientId }, "JWT verification failed");
            return null;
          });
        if (!valid)
          throw createError({
            statusCode: 403,
            message: "Invalid nonce signature.",
          });
        break;
      }
      default: {
        throw createError({
          statusCode: 403,
          message: "No authentication",
        });
      }
    }

    if (clientId === undefined)
      throw createError({
        statusCode: 500,
        message: "Failed to execute authentication pipeline.",
      });

    async function fetchClient() {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client)
        throw new Error(
          "client util fetch client broke - this should NOT happen",
        );
      return client;
    }

    async function fetchUser() {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          user: true,
        },
      });

      if (!client)
        throw new Error(
          "client util fetch client broke - this should NOT happen",
        );

      return client.user;
    }

    const utils: ClientUtils = {
      clientId,
      fetchClient,
      fetchUser,
    };

    // Ignore response because we don't care if this fails
    await prisma.client.updateMany({
      where: { id: clientId },
      data: { lastConnected: new Date() },
    });

    return await handler(h3, utils);
  });
}

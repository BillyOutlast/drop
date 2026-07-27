import { DateTime } from "luxon";

import prisma from "../db/database";
import type { SessionProvider, SessionWithToken } from "./types";
import cacheHandler from "../cache";
import type { SessionWhereInput, JsonFilter } from "~/prisma/client/models";
import type { InputJsonValue } from "@prisma/client/runtime/client";

export default function createDBSessionHandler(): SessionProvider {
  const cache = cacheHandler.createCache<SessionWithToken>("DBSession");

  return {
    async setSession(token, session) {
      await cache.set(token, { ...session, token });

      const result = await prisma.session.upsert({
        where: {
          token,
        },
        create: {
          token,
          ...(session.authenticated?.userId
            ? { userId: session.authenticated?.userId }
            : undefined),
          expiresAt: session.expiresAt,
          data: session as object,
        },

        update: {
          expiresAt: session.expiresAt,
          data: session as object,
        },
      });

      // need to cast to Session since prisma returns different json types
      return result.data as unknown as SessionWithToken;
    },
    async updateSession(token, data) {
      return (await this.setSession(token, data)) !== undefined;
    },
    async getSession<T extends SessionWithToken>(token: string) {
      const cached = await cache.get(token);
      if (cached !== null) return cached as T;

      const result = await prisma.session.findUnique({
        where: {
          token,
        },
      });
      if (result === null) return undefined;

      // add to cache
      // need to cast to Session since prisma returns a more specific type
      await cache.set(token, result as SessionWithToken);

      // i hate casting
      // need to cast to unknown since result.data can be an N deep json object technically
      // ts doesn't like that be cast down to the more constraining session type
      return result.data as unknown as T;
    },
    async removeSession(token) {
      await cache.remove(token);
      const { count } = await prisma.session.deleteMany({
        where: {
          token,
        },
      });
      return count > 0;
    },
    async cleanupSessions() {
      const now = new Date();

      await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });
    },
    async getNumberActiveSessions() {
      return (
        (
          await prisma.session.groupBy({
            by: ["userId"],
            where: {
              expiresAt: {
                gt: DateTime.now().toJSDate(),
              },
              userId: { not: null },
            },
          })
        ).length || 0
      );
    },
    async findSessions(options) {
      const search: SessionWhereInput[] = [];
      if (options.userId) {
        search.push({ userId: options.userId });
      }

      // NOTE: in the DB, the entire session subject is stored in the "data" field
      // so we need to search within that JSON object for the items we want

      if (options.data && typeof options.data === "object") {
        const entries = walkJsonPath(options.data);
        for (const { path, value } of entries) {
          const filter: JsonFilter<"Session"> = {
            // set base path to data
            path: ["data", ...path],
            equals: value as InputJsonValue,
          };
          search.push({ data: filter });
        }
      }
      if (options.oidc && typeof options.oidc === "object") {
        const entries = walkJsonPath(options.oidc);
        for (const { path, value } of entries) {
          const filter: JsonFilter<"Session"> = {
            // set base path to oidc
            path: ["oidc", ...path],
            equals: value as InputJsonValue,
          };
          search.push({ data: filter });
        }
      }

      if (search.length === 0) {
        return [];
      }

      // console.log("Searching sessions with:", JSON.stringify(search, null, 2));

      const sessions = await prisma.session.findMany({
        where: {
          AND: search,
        },
      });
      const results: SessionWithToken[] = [];
      for (const session of sessions) {
        // need to cast to Session since prisma returns different json types
        results.push(session.data as unknown as SessionWithToken);
      }

      return results;
    },
  };
}

/**
 * Enumerates paths and their corresponding leaf values within JSON-compatible data.
 *
 * @param obj - The data to traverse.
 * @param basePath - The path prefix for the returned entries.
 * @returns The paths and values found beneath the input data.
 */
function walkJsonPath(
  obj: unknown,
  basePath: string[] = [],
): Array<{ path: string[]; value: unknown }> {
  if (Array.isArray(obj)) {
    return walkArray(obj, basePath);
  }

  if (obj !== null && typeof obj === "object") {
    return walkObject(obj as Record<string, unknown>, basePath);
  }

  if (basePath.length > 0) {
    return [{ path: basePath, value: obj }];
  }
  return [];
}

/**
 * Collects paths and values for defined elements in an array.
 *
 * @param arr - The array to traverse
 * @param basePath - The path prefix for each array element
 * @returns Path and value pairs for the array's defined elements
 */
function walkArray(
  arr: unknown[],
  basePath: string[],
): Array<{ path: string[]; value: unknown }> {
  const results: Array<{ path: string[]; value: unknown }> = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v === undefined) continue;
    collectPathValue(v, [...basePath, String(i)], results);
  }
  return results;
}

/**
 * Collects paths and primitive values from an object, excluding undefined properties.
 *
 * @param obj - The object to traverse
 * @param basePath - The path prefix for the object's properties
 * @returns The paths and values found within the object
 */
function walkObject(
  obj: Record<string, unknown>,
  basePath: string[],
): Array<{ path: string[]; value: unknown }> {
  const results: Array<{ path: string[]; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    collectPathValue(v, [...basePath, k], results);
  }
  return results;
}

/**
 * Collects a leaf value and its JSON path, expanding nested objects and arrays.
 *
 * @param value - The value to collect or expand
 * @param path - The path associated with the value
 * @param results - The array to which collected path-value pairs are appended
 */
function collectPathValue(
  value: unknown,
  path: string[],
  results: Array<{ path: string[]; value: unknown }>,
) {
  if (value !== null && typeof value === "object") {
    results.push(...walkJsonPath(value, path));
  } else {
    results.push({ path, value });
  }
}

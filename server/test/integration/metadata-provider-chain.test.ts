/**
 * Integration tests: MetadataHandler provider chain behavior.
 *
 * Tests MetadataHandler beyond what provider-chain.test.ts covers:
 * priority ordering, manual provider exclusion, empty results,
 * fetchProviderIdsInOrder ordering, and source metadata accuracy.
 *
 * Uses mock providers (like provider-chain.test.ts) because real
 * providers use Nuxt's $fetch which MSW cannot intercept in vitest.
 */

import { describe, expect, it, vi } from "vitest";
import {
  MetadataHandler,
  MetadataProvider,
} from "../../server/internal/metadata/index";
import { MetadataSource } from "~/prisma/client/enums";
import type { GameMetadataSearchResult } from "../../server/internal/metadata/types";

// ---------------------------------------------------------------------------
// Module mocks — prevent Prisma, Nuxt chain from loading at import time
// ---------------------------------------------------------------------------
vi.mock("../../server/internal/config/sys-conf", () => ({
  systemConfig: {
    getMetadataTimeout: () => 100,
    getDropVersion: () => "test",
  },
}));

vi.mock("../../server/internal/db/database", () => ({
  default: {},
}));

vi.mock("../../server/internal/objects", () => ({
  default: {},
}));

vi.mock("../../server/internal/tasks", () => ({
  default: { create: vi.fn() },
  wrapTaskContext: vi.fn(),
}));

vi.mock("../../server/internal/library", () => ({
  createGameImportTaskId: vi.fn().mockReturnValue("test-task-id"),
}));

vi.mock("fast-fuzzy", () => ({
  fuzzy: vi.fn((_query: string, name: string) => {
    const scores: Record<string, number> = {
      "Alpha Game": 0.95,
      "Beta Game": 0.7,
      "Gamma Game": 0.4,
    };
    return scores[name] ?? 0.5;
  }),
}));

// ---------------------------------------------------------------------------
// Mock Provider
// ---------------------------------------------------------------------------
class SearchProvider extends MetadataProvider {
  readonly name: () => string;
  readonly source: () => MetadataSource;
  readonly results: GameMetadataSearchResult[];

  constructor(
    label: string,
    src: MetadataSource,
    results: GameMetadataSearchResult[],
  ) {
    super();
    this.name = () => label;
    this.source = () => src;
    this.results = results;
  }
  async search(): Promise<GameMetadataSearchResult[]> {
    return this.results;
  }
  async fetchGame(): Promise<never> {
    throw new Error("not used");
  }
  async fetchCompany(): Promise<undefined> {
    return undefined;
  }
}

function result(id: string, name: string): GameMetadataSearchResult {
  return { id, name, icon: "", description: "", year: 2024 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("MetadataHandler provider chain behavior", () => {
  it("respects priority ordering via fetchProviderIdsInOrder", () => {
    const handler = new MetadataHandler();
    handler.addProvider(new SearchProvider("Low", MetadataSource.Steam, []), 0);
    handler.addProvider(
      new SearchProvider("High", MetadataSource.IGDB, []),
      10,
    );
    handler.addProvider(
      new SearchProvider("Mid", MetadataSource.GiantBomb, []),
      5,
    );

    const ids = handler.fetchProviderIdsInOrder();

    // Manual is filtered out, others sorted by priority desc
    expect(ids).toEqual([
      MetadataSource.IGDB, // priority 10
      MetadataSource.GiantBomb, // priority 5
      MetadataSource.Steam, // priority 0
    ]);
  });

  it("excludes Manual provider from fetchProviderIdsInOrder", () => {
    const handler = new MetadataHandler();
    handler.addProvider(
      new SearchProvider("Man", MetadataSource.Manual, []),
      10,
    );
    handler.addProvider(
      new SearchProvider("Steam", MetadataSource.Steam, []),
      5,
    );

    const ids = handler.fetchProviderIdsInOrder();

    expect(ids).not.toContain("Manual");
    expect(ids).toContain(MetadataSource.Steam);
  });

  it("returns empty array when no providers are added", async () => {
    const handler = new MetadataHandler();
    const results = await handler.search("any query");
    expect(results).toEqual([]);
  });

  it("attaches source metadata to every result", async () => {
    const handler = new MetadataHandler();
    handler.addProvider(
      new SearchProvider("SteamProv", MetadataSource.Steam, [
        result("s1", "Alpha Game"),
      ]),
      10,
    );
    handler.addProvider(
      new SearchProvider("IGDBProv", MetadataSource.IGDB, [
        result("i1", "Beta Game"),
      ]),
      5,
    );

    const results = await handler.search("game");

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r).toHaveProperty("sourceId");
      expect(r).toHaveProperty("sourceName");
      expect(r).toHaveProperty("fuzzy");
    }
    // Source metadata is correct
    const steamResult = results.find((r) => r.name === "Alpha Game");
    expect(steamResult?.sourceId).toBe(MetadataSource.Steam);
    expect(steamResult?.sourceName).toBe("SteamProv");
  });

  it("sorts merged results by fuzzy score descending", async () => {
    const handler = new MetadataHandler();
    handler.addProvider(
      new SearchProvider("ProvA", MetadataSource.Steam, [
        result("g1", "Gamma Game"),
      ]),
      0,
    );
    handler.addProvider(
      new SearchProvider("ProvB", MetadataSource.IGDB, [
        result("a1", "Alpha Game"),
        result("b1", "Beta Game"),
      ]),
      10,
    );

    const results = await handler.search("game");

    expect(results.map((r) => r.name)).toEqual([
      "Alpha Game", // 0.95
      "Beta Game", // 0.7
      "Gamma Game", // 0.4
    ]);
  });

  it("deduplicates empty results from providers", async () => {
    const handler = new MetadataHandler();
    handler.addProvider(
      new SearchProvider("Empty", MetadataSource.Manual, []),
      10,
    );
    handler.addProvider(
      new SearchProvider("HasResults", MetadataSource.Steam, [
        result("s1", "Alpha Game"),
      ]),
      5,
    );

    const results = await handler.search("game");

    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Alpha Game");
  });
});

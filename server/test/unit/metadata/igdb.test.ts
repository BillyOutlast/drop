import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { IGDBProvider } from "../../../server/internal/metadata/igdb";
import { MissingMetadataProviderConfig } from "../../../server/internal/metadata";
import { MetadataSource } from "~/prisma/client/enums";

// ---------------------------------------------------------------------------
// Module mocks — prevent Prisma / Nuxt chain from loading at import time
// ---------------------------------------------------------------------------

vi.mock("../../../server/internal/config/sys-conf", () => ({
  systemConfig: {
    getMetadataTimeout: () => 100,
    getDropVersion: () => "test",
  },
}));

vi.mock("../../../server/internal/db/database", () => ({
  default: {},
}));

vi.mock("../../../server/internal/objects", () => ({
  default: {},
}));

vi.mock("../../../server/internal/tasks", () => ({
  default: { create: vi.fn() },
  wrapTaskContext: vi.fn(),
}));

vi.mock("../../../server/internal/library", () => ({
  createGameImportTaskId: vi.fn().mockReturnValue("test-task-id"),
}));

describe("IGDBProvider", () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIG_ENV,
      IGDB_CLIENT_ID: "test-client-id",
      IGDB_CLIENT_SECRET: "test-client-secret",
    };
  });

  afterEach(() => {
    process.env = ORIG_ENV;
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // search() — successful result parsing
  // -----------------------------------------------------------------------
  it("returns parsed search results with id, name, icon, description, year", async () => {
    const provider = new IGDBProvider();
    const requestSpy = vi.spyOn(
      provider as unknown as { request: ReturnType<typeof vi.fn> },
      "request",
    );
    // First call: games search returns stub with cover ID
    requestSpy.mockResolvedValueOnce([
      {
        id: 42,
        name: "Test Game",
        cover: 100,
        first_release_date: 1700000000,
        summary: "A test game description",
      },
    ]);
    // Second call: covers fetch for getIconURL(100)
    requestSpy.mockResolvedValueOnce([{ id: 100, image_id: "co1234" }]);

    const results = await provider.search("test");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: "42",
      name: "Test Game",
      icon: "https://images.igdb.com/igdb/image/upload/t_thumb/co1234.jpg",
      description: "A test game description",
      year: 2023,
    });
  });

  // -----------------------------------------------------------------------
  // search() — empty IGDB response
  // -----------------------------------------------------------------------
  it("returns empty array when IGDB returns empty response", async () => {
    const provider = new IGDBProvider();
    const requestSpy = vi.spyOn(
      provider as unknown as { request: ReturnType<typeof vi.fn> },
      "request",
    );
    requestSpy.mockResolvedValueOnce([]);

    const results = await provider.search("test");

    expect(results).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // search() — cover undefined → icon = ""
  // -----------------------------------------------------------------------
  it("returns empty icon string when cover is undefined", async () => {
    const provider = new IGDBProvider();
    const requestSpy = vi.spyOn(
      provider as unknown as { request: ReturnType<typeof vi.fn> },
      "request",
    );
    // No cover field → cover undefined → icon = ""
    requestSpy.mockResolvedValueOnce([
      {
        id: 7,
        name: "No Cover Game",
        first_release_date: 1700000000,
        summary: "No cover art available",
      },
    ]);
    // No second call: getIconURL not invoked when cover undefined

    const results = await provider.search("test");

    expect(results).toHaveLength(1);
    expect(results[0].icon).toBe("");
    expect(results[0].id).toBe("7");
  });

  // -----------------------------------------------------------------------
  // search() — first_release_date undefined → year = 0
  // -----------------------------------------------------------------------
  it("returns year=0 when first_release_date is undefined", async () => {
    const provider = new IGDBProvider();
    const requestSpy = vi.spyOn(
      provider as unknown as { request: ReturnType<typeof vi.fn> },
      "request",
    );
    // Has cover but no first_release_date
    requestSpy.mockResolvedValueOnce([
      {
        id: 8,
        name: "No Date Game",
        cover: 101,
        summary: "Release date unknown",
      },
    ]);
    // Second call: covers fetch for getIconURL(101)
    requestSpy.mockResolvedValueOnce([{ id: 101, image_id: "co5678" }]);

    const results = await provider.search("test");

    expect(results).toHaveLength(1);
    expect(results[0].year).toBe(0);
    expect(results[0].name).toBe("No Date Game");
  });

  // -----------------------------------------------------------------------
  // Constructor — missing env config
  // -----------------------------------------------------------------------
  it("throws MissingMetadataProviderConfig when IGDB_CLIENT_ID is missing", () => {
    process.env = { ...ORIG_ENV, IGDB_CLIENT_SECRET: "test-secret" };
    delete process.env.IGDB_CLIENT_ID;

    expect(() => new IGDBProvider()).toThrow(MissingMetadataProviderConfig);
  });

  it("throws MissingMetadataProviderConfig when IGDB_CLIENT_SECRET is missing", () => {
    process.env = { ...ORIG_ENV, IGDB_CLIENT_ID: "test-id" };
    delete process.env.IGDB_CLIENT_SECRET;

    expect(() => new IGDBProvider()).toThrow(MissingMetadataProviderConfig);
  });

  // -----------------------------------------------------------------------
  // source() — correct enum
  // -----------------------------------------------------------------------
  it("source() returns MetadataSource.IGDB", () => {
    const provider = new IGDBProvider();

    expect(provider.source()).toBe(MetadataSource.IGDB);
  });
});

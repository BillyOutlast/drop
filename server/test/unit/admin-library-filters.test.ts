import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/internal/db/database", () => ({ default: {} }));
vi.mock("~/server/internal/library", () => ({
  default: { fetchGamesWithStatus: vi.fn() },
}));
vi.mock("~/server/internal/acls", () => ({
  default: { allowSystemACL: vi.fn().mockResolvedValue(true) },
}));

import { buildFilters } from "~/server/api/v1/admin/library/index.get";

function q(overrides: Record<string, unknown> = {}) {
  return { sort: "default" as const, order: "desc" as const, ...overrides };
}

describe("buildFilters", () => {
  it("returns undefined when no filters or query provided", () => {
    expect(buildFilters(q())).toBeUndefined();
  });

  it("returns undefined when filters array empty and no query", () => {
    expect(buildFilters(q({ filters: [] }))).toBeUndefined();
  });

  it("builds version.none filter", () => {
    const result = buildFilters(q({ filters: ["version.none"] }));
    expect(result).toEqual({ where: { versions: { none: {} } } });
  });

  it("builds metadata.featured filter", () => {
    const result = buildFilters(q({ filters: ["metadata.featured"] }));
    expect(result).toEqual({ where: { featured: true } });
  });

  it("builds metadata.noCarousel filter", () => {
    const result = buildFilters(q({ filters: ["metadata.noCarousel"] }));
    expect(result).toEqual({
      where: { mImageCarouselObjectIds: { isEmpty: true } },
    });
  });

  it("builds metadata.emptyDescription filter", () => {
    const result = buildFilters(q({ filters: ["metadata.emptyDescription"] }));
    expect(result).toEqual({ where: { mDescription: "" } });
  });

  it("builds search query filter", () => {
    const result = buildFilters(q({ query: "zelda" }));
    expect(result).toEqual({
      where: { mName: { contains: "zelda", mode: "insensitive" } },
    });
  });

  it("combines multiple filters with deepmerge", () => {
    const result = buildFilters(
      q({ filters: ["version.none", "metadata.featured"] }),
    );
    expect(result).toEqual({
      where: {
        versions: { none: {} },
        featured: true,
      },
    });
  });

  it("combines filters with search query", () => {
    const result = buildFilters(
      q({ filters: ["metadata.featured"], query: "portal" }),
    );
    const where = (result as { where: Record<string, unknown> }).where;
    expect(where.featured).toBe(true);
    expect(where.mName).toEqual({ contains: "portal", mode: "insensitive" });
  });

  it("ignores unknown filter keys gracefully", () => {
    const result = buildFilters(q({ filters: ["unknown.filter"] }));
    expect(result).toBeUndefined();
  });

  it("ignores empty filters array with a valid query", () => {
    const result = buildFilters(q({ filters: [], query: "test" }));
    const where = (result as { where: Record<string, unknown> }).where;
    expect(where.mName).toEqual({ contains: "test", mode: "insensitive" });
  });
});

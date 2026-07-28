import { describe, expect, it, vi, beforeEach } from "vitest";
import aclManager from "../../../server/internal/acls";
import prisma from "../../../server/internal/db/database";

vi.mock("../../../server/internal/acls", () => ({
  default: {
    allowSystemACL: vi.fn(),
  },
}));

vi.mock("../../../server/internal/db/database", () => ({
  default: {
    company: {
      updateManyAndReturn: vi.fn(),
    },
    game: {
      updateManyAndReturn: vi.fn(),
    },
  },
}));

describe("Mass Assignment Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aclManager.allowSystemACL).mockResolvedValue(true);
  });

  describe("Company PATCH", () => {
    it("only allows whitelisted fields", async () => {
      vi.stubGlobal(
        "readBody",
        vi.fn().mockResolvedValue({
          mName: "Valid Name",
          mWebsite: "https://example.com",
          id: "should-be-removed",
          createdAt: "should-be-removed",
          adminField: "should-be-removed",
        }),
      );
      vi.stubGlobal("getRouterParam", vi.fn().mockReturnValue("company-1"));
      vi.stubGlobal("createError", (opts: unknown) => {
        throw opts;
      });
      vi.mocked(prisma.company.updateManyAndReturn).mockResolvedValue([
        { id: "company-1", mName: "Valid Name" },
      ] as never);

      const handler = (
        await import("../../../server/api/v1/admin/company/[id]/index.patch")
      ).default;
      await handler({} as never);

      expect(prisma.company.updateManyAndReturn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            id: expect.anything(),
            createdAt: expect.anything(),
            adminField: expect.anything(),
          }),
        }),
      );
    });

    it("rejects null body", async () => {
      vi.stubGlobal("readBody", vi.fn().mockResolvedValue(null));
      vi.stubGlobal("createError", (opts: unknown) => {
        throw opts;
      });

      const handler = (
        await import("../../../server/api/v1/admin/company/[id]/index.patch")
      ).default;
      await expect(handler({} as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("rejects array body", async () => {
      vi.stubGlobal("readBody", vi.fn().mockResolvedValue([1, 2, 3]));
      vi.stubGlobal("createError", (opts: unknown) => {
        throw opts;
      });

      const handler = (
        await import("../../../server/api/v1/admin/company/[id]/index.patch")
      ).default;
      await expect(handler({} as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("Game PATCH", () => {
    it("only allows whitelisted fields", async () => {
      vi.stubGlobal(
        "readBody",
        vi.fn().mockResolvedValue({
          mName: "Valid Game",
          mDescription: "A game",
          id: "should-be-removed",
          libraryId: "should-be-removed",
        }),
      );
      vi.stubGlobal("getRouterParam", vi.fn().mockReturnValue("game-1"));
      vi.stubGlobal("createError", (opts: unknown) => {
        throw opts;
      });
      vi.mocked(prisma.game.updateManyAndReturn).mockResolvedValue([
        { id: "game-1", mName: "Valid Game" },
      ] as never);

      const handler = (
        await import("../../../server/api/v1/admin/game/[id]/index.patch")
      ).default;
      await handler({} as never);

      expect(prisma.game.updateManyAndReturn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            id: expect.anything(),
            libraryId: expect.anything(),
          }),
        }),
      );
    });
  });
});

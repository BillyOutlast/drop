import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const id = getRouterParam(h3, "id")!;

  // Whitelist allowed fields to prevent mass assignment
  const allowedFields = [
    "name",
    "description",
    "slug",
    "coverId",
    "backgroundId",
    "iconId",
    "headerId",
    "companyId",
  ];
  const restOfTheBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key)),
  );

  const newObj = (
    await prisma.game.updateManyAndReturn({
      where: {
        id: id,
      },
      data: restOfTheBody,
      // I would put a select here, but it would be based on the body, and muck up the types
    })
  ).at(0);

  if (!newObj)
    throw createError({ statusCode: 404, message: "Game not found" });

  return newObj;
});

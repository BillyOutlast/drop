import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, message: "Invalid request body" });
  const id = getRouterParam(h3, "id")!;

  const allowedFields = new Set([
    "mName",
    "mShortDescription",
    "mDescription",
    "mReleased",
    "mIconObjectId",
    "mBannerObjectId",
    "mCoverObjectId",
    "mImageCarouselObjectIds",
    "mImageLibraryObjectIds",
    "featured",
  ]);
  const sanitizedData = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.has(key)),
  );

  const newObj = (
    await prisma.game.updateManyAndReturn({
      where: {
        id: id,
      },
      data: sanitizedData,
      // I would put a select here, but it would be based on the body, and muck up the types
    })
  ).at(0);

  if (!newObj)
    throw createError({ statusCode: 404, message: "Game not found" });

  return newObj;
});

import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { validateAndSanitizeBody } from "~/server/api/v1/admin/_helpers";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
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
  const sanitizedData = validateAndSanitizeBody(body, allowedFields);

  const newObj = (
    await prisma.game.updateManyAndReturn({
      where: { id },
      data: sanitizedData,
    })
  ).at(0);
  if (!newObj)
    throw createError({ statusCode: 404, message: "Game not found" });

  return newObj;
});

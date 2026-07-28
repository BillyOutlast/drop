import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { validateAndSanitizeBody } from "~/server/api/v1/admin/_helpers";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const id = getRouterParam(h3, "id")!;

  const allowedFields = new Set([
    "mName",
    "mShortDescription",
    "mDescription",
    "mLogoObjectId",
    "mBannerObjectId",
    "mWebsite",
  ]);
  const sanitizedData = validateAndSanitizeBody(body, allowedFields);

  const newObj = (
    await prisma.company.updateManyAndReturn({
      where: { id },
      data: sanitizedData,
    })
  ).at(0);
  if (!newObj)
    throw createError({ statusCode: 404, message: "Company not found" });

  return newObj;
});

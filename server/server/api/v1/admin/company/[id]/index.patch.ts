import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, message: "Invalid request body" });
  const id = getRouterParam(h3, "id")!;

  const allowedFields = new Set(["name", "description", "website"]);
  const restOfTheBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.has(key)),
  );

  const newObj = (
    await prisma.company.updateManyAndReturn({
      where: {
        id: id,
      },
      data: restOfTheBody,
      // I would put a select here, but it would be based on the body, and muck up the types
    })
  ).at(0);
  if (!newObj)
    throw createError({ statusCode: 404, message: "Company not found" });

  return newObj;
});

import prisma from "~/server/internal/db/database";
import objectHandler from "~/server/internal/objects";
import { defineDropTask } from "..";

type FieldReferenceMap = {
  [modelName: string]: {
    model: unknown; // Prisma model
    fields: string[]; // Fields that may contain IDs
    arrayFields: string[]; // Fields that are arrays that may contain IDs
  };
};

export default defineDropTask({
  buildId: () => `cleanup:objects:${Date.now()}`,
  name: "Cleanup Objects",
  acls: ["system:maintenance:read"],
  taskGroup: "cleanup:objects",
  async run({ progress, logger }) {
    logger.info("Cleaning unreferenced objects");

    // get all objects
    const objects = await objectHandler.listAll();
    logger.info(`searching for ${objects.length} objects`);
    progress(30);

    // find unreferenced objects
    const refMap = buildRefMap();
    logger.info("Building reference map");
    logger.info(
      `Found ${Object.keys(refMap).length} models with reference fields`,
    );
    logger.info("Searching for unreferenced objects");
    const unrefedObjects = await findUnreferencedStrings(objects, refMap);
    logger.info(`found ${unrefedObjects.length} Unreferenced objects`);
    // logger.info(unrefedObjects);
    progress(60);

    // remove objects
    const deletePromises: Promise<boolean>[] = [];
    for (const obj of unrefedObjects) {
      logger.info(`Deleting object ${obj}`);
      deletePromises.push(objectHandler.deleteAsSystem(obj));
    }
    await Promise.all(deletePromises);

    // Remove any possible leftover metadata
    await objectHandler.cleanupMetadata(logger);

    logger.info("Done");
    progress(100);
  },
});

/**
 * Builds a map of Prisma models and fields that may reference object IDs.
 *
 * @returns A field reference map containing each model, its scalar object ID fields, and its array object ID fields.
 */
function buildRefMap(): FieldReferenceMap {
  const tables = Object.keys(prisma).filter(
    (v) => !(v.startsWith("$") || v.startsWith("_") || v === "constructor"),
  );
  // type test = Prisma.ModelName
  // prisma.game.fields.mIconId.

  const result: FieldReferenceMap = {};

  for (const model of tables) {
    // @ts-expect-error can't get model to typematch key names
    const fields = Object.keys(prisma[model]["fields"]);

    const single = fields.filter((v) => v.toLowerCase().endsWith("objectid"));
    const array = fields.filter((v) => v.toLowerCase().endsWith("objectids"));

    result[model] = {
      // @ts-expect-error im not dealing with this
      model: prisma[model],
      fields: single,
      arrayFields: array,
    };
  }

  return result;
}

/**
 * Identifies object IDs referenced by the configured scalar and array fields.
 *
 * @param objectIds - The object IDs to check
 * @param fieldRefMap - The models and fields to inspect
 * @returns A set containing the referenced object IDs
 */
async function findReferencedIds(
  objectIds: string[],
  fieldRefMap: FieldReferenceMap,
): Promise<Set<string>> {
  const referenced = new Set<string>();

  for (const { model, fields, arrayFields } of Object.values(fieldRefMap)) {
    // Build OR conditions for scalar fields using 'in' (batched)
    const singleFieldConditions = fields.map((field) => ({
      [field]: { in: objectIds },
    }));

    // Build OR conditions for array fields using 'has' (one per object per field)
    const arrayFieldConditions: Array<Record<string, Record<string, string>>> =
      [];
    for (const field of arrayFields) {
      for (const id of objectIds) {
        arrayFieldConditions.push({ [field]: { has: id } });
      }
    }

    const orConditions = [...singleFieldConditions, ...arrayFieldConditions];
    if (orConditions.length === 0) continue;

    // @ts-expect-error dynamic model access
    const rows = await model.findMany({
      where: { OR: orConditions },
      select: Object.fromEntries([
        ...fields.map((f) => [f, true]),
        ...arrayFields.map((f) => [f, true]),
      ]),
    });

    // Extract referenced IDs from results
    for (const row of rows) {
      for (const field of fields) {
        const val = row[field];
        if (val && typeof val === "string" && objectIds.includes(val)) {
          referenced.add(val);
        }
      }
      for (const field of arrayFields) {
        const arr = row[field];
        if (Array.isArray(arr)) {
          for (const val of arr) {
            if (typeof val === "string" && objectIds.includes(val)) {
              referenced.add(val);
            }
          }
        }
      }
    }
  }

  return referenced;
}

/**
 * Identifies object IDs that are not referenced by any model fields.
 *
 * @param objects - The object IDs to inspect
 * @param fieldRefMap - The model fields that may reference object IDs
 * @returns The object IDs with no references
 */
async function findUnreferencedStrings(
  objects: string[],
  fieldRefMap: FieldReferenceMap,
): Promise<string[]> {
  const referenced = await findReferencedIds(objects, fieldRefMap);
  return objects.filter((id) => !referenced.has(id));
}

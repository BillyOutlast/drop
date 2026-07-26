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
 * Builds WHERE conditions for querying references.
 *
 * @param objectIds - The object IDs to check
 * @param fields - Scalar fields to check
 * @param arrayFields - Array fields to check
 * @returns Array of OR condition objects
 */
function buildOrConditions(
  objectIds: string[],
  fields: string[],
  arrayFields: string[],
): Array<Record<string, unknown>> {
  const singleFieldConditions = fields.map((field) => ({
    [field]: { in: objectIds },
  }));

  const arrayFieldConditions = arrayFields.map((field) => ({
    [field]: { hasSome: objectIds },
  }));

  return [...singleFieldConditions, ...arrayFieldConditions];
}

/**
 * Extracts referenced object IDs from query results.
 *
 * @param rows - Query result rows
 * @param fields - Scalar fields to extract
 * @param arrayFields - Array fields to extract
 * @param objectIds - Valid object IDs to filter
 * @param referenced - Set to accumulate referenced IDs into
 */
function extractScalarReferences(
  row: Record<string, unknown>,
  fields: string[],
  validIds: Set<string>,
  referenced: Set<string>,
): void {
  for (const field of fields) {
    const val = row[field];
    if (typeof val === "string" && validIds.has(val)) {
      referenced.add(val);
    }
  }
}

function extractArrayReferences(
  row: Record<string, unknown>,
  arrayFields: string[],
  validIds: Set<string>,
  referenced: Set<string>,
): void {
  for (const field of arrayFields) {
    const arr = row[field];
    if (!Array.isArray(arr)) continue;
    for (const val of arr) {
      if (typeof val === "string" && validIds.has(val)) {
        referenced.add(val);
      }
    }
  }
}

function extractReferencedIds(
  rows: Array<Record<string, unknown>>,
  fields: string[],
  arrayFields: string[],
  objectIds: string[],
  referenced: Set<string>,
): void {
  const validIds = new Set(objectIds);
  for (const row of rows) {
    extractScalarReferences(row, fields, validIds, referenced);
    extractArrayReferences(row, arrayFields, validIds, referenced);
  }
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
  const BATCH_SIZE = 500;

  for (const { model, fields, arrayFields } of Object.values(fieldRefMap)) {
    // Process in batches to avoid overwhelming the query builder with large ID lists
    for (let i = 0; i < objectIds.length; i += BATCH_SIZE) {
      const batch = objectIds.slice(i, i + BATCH_SIZE);
      const orConditions = buildOrConditions(batch, fields, arrayFields);

      if (orConditions.length === 0) continue;

      // @ts-expect-error dynamic model access
      const rows = await model.findMany({
        where: { OR: orConditions },
        select: Object.fromEntries([
          ...fields.map((f) => [f, true]),
          ...arrayFields.map((f) => [f, true]),
        ]),
      });

      extractReferencedIds(rows, fields, arrayFields, batch, referenced);
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

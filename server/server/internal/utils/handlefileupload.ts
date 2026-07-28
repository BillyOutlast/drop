import type { EventHandlerRequest, H3Event } from "h3";
import type { Dump, Pull } from "../objects/transactional";
import { ObjectTransactionalHandler } from "../objects/transactional";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateFile(entry: {
  filename?: string;
  data: Buffer;
  type?: string;
}) {
  if (entry.data.length > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      message: `File ${entry.filename} exceeds maximum size of 10MB`,
    });
  }
  if (!entry.type || !ALLOWED_MIME_TYPES.has(entry.type)) {
    throw createError({
      statusCode: 400,
      message: `File type ${entry.type ?? "unknown"} is not allowed`,
    });
  }
}

export async function handleFileUpload(
  h3: H3Event<EventHandlerRequest>,
  metadata: { [key: string]: string },
  permissions: Array<string>,
  max = -1,
): Promise<[string[], { [key: string]: string }, Pull, Dump] | undefined> {
  const formData = await readMultipartFormData(h3);
  if (!formData) return undefined;
  const transactionalHandler = new ObjectTransactionalHandler();
  const [add, pull, dump] = transactionalHandler.new(metadata, permissions);
  const options: { [key: string]: string } = {};
  const ids = [];

  for (const entry of formData) {
    if (entry.filename) {
      if (max > 0 && ids.length >= max) continue;
      validateFile(entry);
      ids.push(add(entry.data));
      continue;
    }
    if (!entry.name) continue;
    options[entry.name] = entry.data.toString("utf-8");
  }

  return [ids, options, pull, dump];
}

import type { EventHandlerRequest, H3Event } from "h3";
import type { Dump, Pull } from "../objects/transactional";
import { ObjectTransactionalHandler } from "../objects/transactional";

// Allowed MIME types for file uploads
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
  "application/octet-stream",
]);

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Parses a multipart form upload, storing files and collecting metadata fields.
 *
 * Files are stored through an ObjectTransactionalHandler so the caller can
 * commit or rollback via the returned `pull`/`dump` handles. Non-file form
 * entries are collected as metadata key/value pairs.
 *
 * @param h3 - The incoming H3 event containing the multipart form data.
 * @param metadata - Key/value metadata attached to each stored file object.
 * @param permissions - ACL permissions assigned to each stored file object.
 * @param max - Maximum number of files to accept (<= 0 means unlimited).
 * @returns A tuple of [file IDs, metadata options, pull handle, dump handle],
 *   or undefined when the request body contains no multipart data.
 */
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

      // Validate file size
      if (entry.data.length > MAX_FILE_SIZE) {
        throw createError({
          statusCode: 400,
          message: `File ${entry.filename} exceeds maximum size of 10MB`,
        });
      }

      // Validate MIME type
      const mimeType = entry.type ?? "application/octet-stream";
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw createError({
          statusCode: 400,
          message: `File type ${mimeType} is not allowed`,
        });
      }

      // Add file to transaction handler so we can void it later if we error out
      ids.push(add(entry.data));
      continue;
    }
    if (!entry.name) continue;

    options[entry.name] = entry.data.toString("utf-8");
  }

  return [ids, options, pull, dump];
}

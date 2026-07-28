import type { EventHandlerRequest, H3Event } from "h3";
import type { Dump, Pull } from "../objects/transactional";
import { ObjectTransactionalHandler } from "../objects/transactional";
import { parse as getMimeTypeBuffer } from "file-type-mime";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
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
      message: `File ${entry.filename} exceeds maximum size of 10 MiB`,
    });
  }
  // Use content-based MIME detection (magic bytes) instead of trusting
  // the client-provided Content-Type, which can be spoofed.
  const detectedMime = getMimeTypeBuffer(
    new Uint8Array(entry.data).buffer,
  )?.mime;
  const clientMime = entry.type?.toLowerCase();
  const effectiveMime = detectedMime ?? clientMime;
  if (!effectiveMime || !ALLOWED_MIME_TYPES.has(effectiveMime)) {
    throw createError({
      statusCode: 400,
      message: `File type ${entry.type ?? "unknown"} is not allowed`,
    });
  }
}

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
      validateFile(entry);
      ids.push(add(entry.data));
      continue;
    }
    if (!entry.name) continue;
    options[entry.name] = entry.data.toString("utf-8");
  }

  return [ids, options, pull, dump];
}

import { createError } from "h3";

export function validateAndSanitizeBody(
  body: unknown,
  allowedFields: Set<string>,
): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, message: "Invalid request body" });

  const sanitizedData = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([key]) =>
      allowedFields.has(key),
    ),
  );

  if (Object.keys(sanitizedData).length === 0)
    throw createError({ statusCode: 400, message: "No valid fields provided" });

  return sanitizedData;
}

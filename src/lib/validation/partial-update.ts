// Zod's `.partial()` makes every field optional but does NOT suppress
// `.default(...)` on fields the caller omitted — schema.partial().parse({dose:
// "10mg"}) against a schema where `status` has `.default("ACTIVE")` silently
// fills in status: "ACTIVE", even though the caller never touched it. Every
// partial update (PATCH, and the correction workflow's correctedFields) must
// filter the parsed result down to keys the caller actually sent, or a
// single-field edit can silently overwrite an unrelated field back to its
// schema default.
export function pickProvidedFields<T extends Record<string, unknown>>(
  parsed: T,
  raw: Record<string, unknown>
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(raw)) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      result[key as keyof T] = parsed[key as keyof T];
    }
  }
  return result;
}

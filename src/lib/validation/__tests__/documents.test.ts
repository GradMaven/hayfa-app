import { describe, expect, it } from "vitest";
import { ocrConfirmSchema } from "../documents";

describe("ocrConfirmSchema", () => {
  it("accepts a real Document id — a UUID (crypto.randomUUID()), not a cuid", () => {
    // Regression test: this field used to be z.string().cuid(), which
    // rejected every real document ID — POST /api/v1/documents generates
    // Document.id with crypto.randomUUID() (needed to build the storage key
    // before the row exists), not Prisma's @default(cuid()). This broke the
    // OCR confirm-before-write flow for every real document; caught via live
    // verification, not a pre-existing test.
    const result = ocrConfirmSchema.safeParse({
      documentId: "ab1fa100-9445-429b-8c70-1cd03f03cba3",
      createAs: "NONE",
      fields: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a cuid-shaped id — it is not what Document.id actually looks like", () => {
    const result = ocrConfirmSchema.safeParse({
      documentId: "cl9ebqhxk00003b600e5j5s0i",
      createAs: "NONE",
      fields: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid createAs value", () => {
    const result = ocrConfirmSchema.safeParse({
      documentId: "ab1fa100-9445-429b-8c70-1cd03f03cba3",
      createAs: "MEDICATION",
      fields: {},
    });
    expect(result.success).toBe(false);
  });
});

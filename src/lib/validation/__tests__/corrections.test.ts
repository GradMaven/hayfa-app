import { describe, expect, it } from "vitest";
import { correctionRequestSchema } from "../corrections";

describe("correctionRequestSchema", () => {
  it("accepts a valid correction request", () => {
    const result = correctionRequestSchema.safeParse({
      resourceType: "MEDICATION",
      resourceId: "clx0000000000000000000000",
      reason: "Dose was recorded incorrectly at the clinic visit",
      correctedFields: { dose: "10mg" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported resource type", () => {
    const result = correctionRequestSchema.safeParse({
      resourceType: "VITAL",
      resourceId: "clx0000000000000000000000",
      reason: "Wrong value",
      correctedFields: { value: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-cuid resourceId", () => {
    const result = correctionRequestSchema.safeParse({
      resourceType: "MEDICATION",
      resourceId: "not-a-cuid",
      reason: "Wrong value",
      correctedFields: { dose: "10mg" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty reason", () => {
    const result = correctionRequestSchema.safeParse({
      resourceType: "MEDICATION",
      resourceId: "clx0000000000000000000000",
      reason: "",
      correctedFields: { dose: "10mg" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty correctedFields object", () => {
    const result = correctionRequestSchema.safeParse({
      resourceType: "MEDICATION",
      resourceId: "clx0000000000000000000000",
      reason: "Wrong value",
      correctedFields: {},
    });
    expect(result.success).toBe(false);
  });
});

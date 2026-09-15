import { describe, expect, it } from "vitest";
import { updatePhoneSchema } from "../account";

describe("updatePhoneSchema", () => {
  it("accepts a valid international phone number", () => {
    expect(updatePhoneSchema.safeParse({ phone: "+254712345678" }).success).toBe(true);
  });

  it("accepts null to clear the phone number", () => {
    expect(updatePhoneSchema.safeParse({ phone: null }).success).toBe(true);
  });

  it("rejects an empty string — must be null to clear, not empty", () => {
    expect(updatePhoneSchema.safeParse({ phone: "" }).success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    expect(updatePhoneSchema.safeParse({ phone: "0712345678" }).success).toBe(false);
  });

  it("rejects a missing phone field", () => {
    expect(updatePhoneSchema.safeParse({}).success).toBe(false);
  });
});

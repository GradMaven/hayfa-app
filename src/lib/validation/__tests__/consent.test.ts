import { describe, expect, it } from "vitest";
import { createConsentSchema, caregiverInviteSchema } from "../consent";

describe("createConsentSchema", () => {
  const base = {
    recipientType: "PROVIDER" as const,
    recipientEmail: "doctor@example.com",
    purpose: "Diabetes consultation",
    duration: "DAYS_30" as const,
  };

  it("rejects a grant with no data scopes selected — never an all-or-nothing share", () => {
    const result = createConsentSchema.safeParse({ ...base, dataScopes: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a grant with at least one explicit scope", () => {
    const result = createConsentSchema.safeParse({ ...base, dataScopes: ["MEDICATIONS"] });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid recipient email", () => {
    const result = createConsentSchema.safeParse({ ...base, recipientEmail: "not-an-email", dataScopes: ["MEDICATIONS"] });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized data scope", () => {
    const result = createConsentSchema.safeParse({ ...base, dataScopes: ["FULL_RECORD"] });
    expect(result.success).toBe(false);
  });
});

describe("caregiverInviteSchema", () => {
  it("requires at least one permission", () => {
    const result = caregiverInviteSchema.safeParse({ caregiverEmail: "spouse@example.com", permissions: [] });
    expect(result.success).toBe(false);
  });
});

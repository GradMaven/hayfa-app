import { describe, expect, it } from "vitest";
import { providerSignUpSchema, providerRejectSchema } from "../provider";

describe("providerSignUpSchema", () => {
  const base = {
    name: "Dr. Peter Kariuki",
    email: "peter.kariuki@example.com",
    password: "correct-horse-battery",
    licenseNumber: "KMPDC-1234",
  };

  it("accepts a minimal valid registration", () => {
    expect(providerSignUpSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an optional specialty and phone", () => {
    const result = providerSignUpSchema.safeParse({ ...base, specialty: "Cardiology", phone: "+254712345678" });
    expect(result.success).toBe(true);
  });

  it("accepts a real cuid organizationId", () => {
    const result = providerSignUpSchema.safeParse({ ...base, organizationId: "cl9ebqhxk00003b600e5j5s0i" });
    expect(result.success).toBe(true);
  });

  it("accepts a human-readable organizationId (what the seed data actually uses)", () => {
    const result = providerSignUpSchema.safeParse({ ...base, organizationId: "demo-org-nairobi-hospital" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string organizationId (treated as omitted)", () => {
    const result = providerSignUpSchema.safeParse({ ...base, organizationId: "" });
    expect(result.success).toBe(true);
  });

  it("requires a license number", () => {
    const result = providerSignUpSchema.safeParse({ ...base, licenseNumber: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    const result = providerSignUpSchema.safeParse({ ...base, phone: "0712345678" });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = providerSignUpSchema.safeParse({ ...base, password: "short" });
    expect(result.success).toBe(false);
  });
});

describe("providerRejectSchema", () => {
  it("requires a non-empty reason", () => {
    expect(providerRejectSchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("accepts a real reason", () => {
    expect(providerRejectSchema.safeParse({ reason: "License number could not be verified." }).success).toBe(true);
  });
});

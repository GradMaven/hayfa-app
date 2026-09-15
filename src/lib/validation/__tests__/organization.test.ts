import { describe, expect, it } from "vitest";
import { organizationSchema, organizationUpdateSchema, assignOrganizationSchema } from "../organization";

describe("organizationSchema", () => {
  it("accepts a minimal valid organization", () => {
    const result = organizationSchema.safeParse({ name: "Nairobi Hospital", type: "HOSPITAL" });
    expect(result.success).toBe(true);
  });

  it("accepts an optional county", () => {
    const result = organizationSchema.safeParse({ name: "Nairobi Hospital", type: "HOSPITAL", county: "Nairobi" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = organizationSchema.safeParse({ type: "HOSPITAL" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid type", () => {
    const result = organizationSchema.safeParse({ name: "Nairobi Hospital", type: "SPACESHIP" });
    expect(result.success).toBe(false);
  });
});

describe("organizationUpdateSchema", () => {
  it("accepts a partial update with just verified", () => {
    const result = organizationUpdateSchema.safeParse({ verified: true });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (no-op update)", () => {
    const result = organizationUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates type when provided", () => {
    const result = organizationUpdateSchema.safeParse({ type: "NOT_A_TYPE" });
    expect(result.success).toBe(false);
  });
});

describe("assignOrganizationSchema", () => {
  it("accepts a real cuid (what POST /api/v1/admin/organizations actually generates)", () => {
    const result = assignOrganizationSchema.safeParse({ organizationId: "cl9ebqhxk00003b600e5j5s0i" });
    expect(result.success).toBe(true);
  });

  it("accepts a human-readable id (what the seed data actually uses, e.g. demo-org-nairobi-hospital)", () => {
    // Regression test: this field used to be z.string().cuid(), which
    // rejected every assignment involving a seeded demo organization —
    // caught via live verification of the admin organization-assignment UI.
    const result = assignOrganizationSchema.safeParse({ organizationId: "demo-org-nairobi-hospital" });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear the assignment", () => {
    const result = assignOrganizationSchema.safeParse({ organizationId: null });
    expect(result.success).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = assignOrganizationSchema.safeParse({ organizationId: "" });
    expect(result.success).toBe(false);
  });
});

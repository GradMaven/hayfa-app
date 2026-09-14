import { describe, expect, it } from "vitest";
import { medicationSchema, vitalSchema, labResultSchema, allergySchema } from "../clinical";

describe("medicationSchema", () => {
  it("accepts a minimal valid medication", () => {
    const result = medicationSchema.safeParse({ name: "Amlodipine" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = medicationSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("defaults status to ACTIVE when omitted", () => {
    const result = medicationSchema.parse({ name: "Amlodipine" });
    expect(result.status).toBe("ACTIVE");
  });

  it("rejects an invalid status", () => {
    const result = medicationSchema.safeParse({ name: "Amlodipine", status: "MADE_UP" });
    expect(result.success).toBe(false);
  });
});

describe("vitalSchema", () => {
  it("accepts a blood pressure reading with systolic and diastolic", () => {
    const result = vitalSchema.safeParse({
      type: "BLOOD_PRESSURE",
      value: 120,
      secondaryValue: 80,
      unit: "mmHg",
      recordedAt: "2026-01-01T08:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-numeric value", () => {
    const result = vitalSchema.safeParse({
      type: "WEIGHT",
      value: "not-a-number",
      unit: "kg",
      recordedAt: "2026-01-01T08:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown vital type", () => {
    const result = vitalSchema.safeParse({
      type: "BODY_TEMPERATURE_IN_CELSIUS", // not a real enum value
      value: 37,
      unit: "C",
      recordedAt: "2026-01-01T08:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("labResultSchema", () => {
  it("defaults flag to NORMAL", () => {
    const result = labResultSchema.parse({
      testName: "HbA1c",
      resultValue: "5.4",
      testDate: "2026-01-01",
    });
    expect(result.flag).toBe("NORMAL");
  });

  it("requires a test date", () => {
    const result = labResultSchema.safeParse({ testName: "HbA1c", resultValue: "5.4" });
    expect(result.success).toBe(false);
  });
});

describe("allergySchema", () => {
  it("defaults severity to UNKNOWN", () => {
    const result = allergySchema.parse({ allergen: "Penicillin" });
    expect(result.severity).toBe("UNKNOWN");
  });
});

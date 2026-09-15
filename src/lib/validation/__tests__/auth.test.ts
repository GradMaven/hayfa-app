import { describe, expect, it } from "vitest";
import { signUpSchema, phoneSchema } from "../auth";

describe("phoneSchema", () => {
  it("accepts a valid international phone number", () => {
    expect(phoneSchema.safeParse("+254712345678").success).toBe(true);
  });

  it("rejects a number without a leading +", () => {
    expect(phoneSchema.safeParse("254712345678").success).toBe(false);
  });

  it("rejects a local-format number", () => {
    expect(phoneSchema.safeParse("0712345678").success).toBe(false);
  });

  it("rejects a number starting with +0", () => {
    expect(phoneSchema.safeParse("+0712345678").success).toBe(false);
  });
});

describe("signUpSchema phone field", () => {
  it("accepts sign-up without a phone number", () => {
    const result = signUpSchema.safeParse({ name: "Amina Otieno", email: "amina@example.com", password: "correct-horse-battery" });
    expect(result.success).toBe(true);
  });

  it("accepts sign-up with an empty string phone (treated as omitted)", () => {
    const result = signUpSchema.safeParse({
      name: "Amina Otieno",
      email: "amina@example.com",
      phone: "",
      password: "correct-horse-battery",
    });
    expect(result.success).toBe(true);
  });

  it("accepts sign-up with a valid phone number", () => {
    const result = signUpSchema.safeParse({
      name: "Amina Otieno",
      email: "amina@example.com",
      phone: "+254712345678",
      password: "correct-horse-battery",
    });
    expect(result.success).toBe(true);
  });

  it("rejects sign-up with a malformed phone number", () => {
    const result = signUpSchema.safeParse({
      name: "Amina Otieno",
      email: "amina@example.com",
      phone: "0712345678",
      password: "correct-horse-battery",
    });
    expect(result.success).toBe(false);
  });
});

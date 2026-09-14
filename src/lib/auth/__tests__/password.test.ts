import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "../password";

describe("password hashing", () => {
  it("never stores the plaintext password in the hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (unique salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("same password"), hashPassword("same password")]);
    expect(a).not.toBe(b);
  });
});

describe("isPasswordStrongEnough", () => {
  it("rejects short passwords", () => {
    expect(isPasswordStrongEnough("short1")).toBe(false);
  });

  it("accepts a password at the 10-character minimum", () => {
    expect(isPasswordStrongEnough("0123456789")).toBe(true);
  });
});

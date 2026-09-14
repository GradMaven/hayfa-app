import { describe, expect, it, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "../mfa-crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = "a".repeat(64);
});

describe("mfa-crypto", () => {
  it("round-trips a secret through encrypt/decrypt", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("never stores the plaintext secret in the ciphertext string", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext));
  });

  it("rejects a tampered ciphertext (GCM auth tag failure)", () => {
    const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = [iv, authTag, ciphertext.slice(0, -4) + "abcd"].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws a clear error when AUTH_SECRET is missing or too short", () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "too-short";
    expect(() => encryptSecret("x")).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = original;
  });
});

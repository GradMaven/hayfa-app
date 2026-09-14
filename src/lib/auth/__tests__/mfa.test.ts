import { describe, expect, it, beforeAll } from "vitest";
import * as OTPAuth from "otpauth";
import {
  generateTotpSecret,
  buildEnrollmentUri,
  encryptTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCodeForLookup,
  looksLikeTotpCode,
} from "../mfa";

beforeAll(() => {
  process.env.AUTH_SECRET = "b".repeat(64);
});

describe("TOTP enrollment + verification", () => {
  it("accepts the current valid code for a freshly generated secret", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    const totp = new OTPAuth.TOTP({ issuer: "Hafya", label: "test@example.com", algorithm: "SHA1", digits: 6, period: 30, secret });
    const currentCode = totp.generate();

    expect(verifyTotpCode(encrypted, "test@example.com", currentCode)).toBe(true);
  });

  it("rejects an incorrect code", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    expect(verifyTotpCode(encrypted, "test@example.com", "000000")).toBe(false);
  });

  it("rejects a code that isn't 6 digits", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    expect(verifyTotpCode(encrypted, "test@example.com", "12345")).toBe(false);
    expect(verifyTotpCode(encrypted, "test@example.com", "abcdef")).toBe(false);
  });

  it("the enrollment URI is a valid otpauth:// URI carrying the issuer", () => {
    const secret = generateTotpSecret();
    const uri = buildEnrollmentUri(secret, "amina@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("Hafya");
  });

  it("two different secrets don't validate each other's codes", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const encryptedA = encryptTotpSecret(secretA);
    const totpB = new OTPAuth.TOTP({ issuer: "Hafya", label: "x", algorithm: "SHA1", digits: 6, period: 30, secret: secretB });
    expect(verifyTotpCode(encryptedA, "x", totpB.generate())).toBe(false);
  });
});

describe("backup codes", () => {
  it("generates the requested count, each matching its own hash", () => {
    const { plaintextCodes, hashes } = generateBackupCodes(10);
    expect(plaintextCodes).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    plaintextCodes.forEach((code, i) => {
      expect(hashBackupCodeForLookup(code)).toBe(hashes[i]);
    });
  });

  it("generates unique codes", () => {
    const { plaintextCodes } = generateBackupCodes(10);
    expect(new Set(plaintextCodes).size).toBe(10);
  });

  it("hash lookup is case- and dash-insensitive so users can retype codes loosely", () => {
    const { plaintextCodes, hashes } = generateBackupCodes(1);
    const code = plaintextCodes[0];
    const messy = code.toLowerCase().replace("-", "");
    expect(hashBackupCodeForLookup(messy)).toBe(hashes[0]);
  });

  it("never stores a code that reveals the plaintext in its hash", () => {
    const { plaintextCodes, hashes } = generateBackupCodes(1);
    expect(hashes[0]).not.toContain(plaintextCodes[0]);
  });
});

describe("looksLikeTotpCode", () => {
  it("distinguishes a 6-digit code from a backup code", () => {
    expect(looksLikeTotpCode("123456")).toBe(true);
    expect(looksLikeTotpCode("ABCDE-FGHIJ")).toBe(false);
    expect(looksLikeTotpCode("12345")).toBe(false);
  });
});

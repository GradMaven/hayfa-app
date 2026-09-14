import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encrypts the TOTP secret at rest so a database dump alone doesn't hand an
// attacker every user's second factor — a hashed-at-rest pattern (like
// sessions/passwords) doesn't work here because the server has to read the
// secret back to verify a code, so this is reversible AES-256-GCM instead.
// Key material comes from AUTH_SECRET, previously unused — see ENVIRONMENT.md.

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error(
      "AUTH_SECRET must be set to a 64-character hex string (32 bytes) to encrypt MFA secrets. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(secret.slice(0, 64), "hex");
}

const IV_LENGTH = 12; // recommended for GCM

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted MFA secret.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

import { randomBytes, createHash } from "crypto";
import * as OTPAuth from "otpauth";
import { encryptSecret, decryptSecret } from "./mfa-crypto";

const ISSUER = "Hafya";
const BACKUP_CODE_COUNT = 10;

export function generateTotpSecret(): OTPAuth.Secret {
  return new OTPAuth.Secret({ size: 20 });
}

function buildTotp(secret: OTPAuth.Secret, accountLabel: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
}

export function buildEnrollmentUri(secret: OTPAuth.Secret, accountLabel: string): string {
  return buildTotp(secret, accountLabel).toString();
}

export function encryptTotpSecret(secret: OTPAuth.Secret): string {
  return encryptSecret(secret.base32);
}

// Validates a 6-digit code against the stored (encrypted) secret, allowing
// ±1 time step (30s) of clock drift — the standard tolerance for TOTP.
// Returns true/false rather than throwing; callers are responsible for their
// own attempt-rate-limiting (see MfaChallenge.attempts).
export function verifyTotpCode(encryptedSecret: string, accountLabel: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const base32 = decryptSecret(encryptedSecret);
  const totp = buildTotp(OTPAuth.Secret.fromBase32(base32), accountLabel);
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export interface GeneratedBackupCodes {
  plaintextCodes: string[];
  hashes: string[];
}

function hashBackupCode(code: string): string {
  // Backup codes are lower entropy than a session token by design (they're
  // meant to be hand-copied), so they're normalized (case/dash-insensitive)
  // before hashing to avoid a user being locked out by formatting.
  return createHash("sha256").update(code.toUpperCase().replace(/-/g, "")).digest("hex");
}

const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

// Rejection-sampled so each character is uniformly distributed over the
// alphabet — a plain `randomByte % alphabet.length` would bias toward the
// low end since 256 isn't a multiple of 33.
function randomAlphabetChar(): string {
  const max = 256 - (256 % BACKUP_CODE_ALPHABET.length);
  let byte: number;
  do {
    byte = randomBytes(1)[0];
  } while (byte >= max);
  return BACKUP_CODE_ALPHABET[byte % BACKUP_CODE_ALPHABET.length];
}

export function generateBackupCodes(count = BACKUP_CODE_COUNT): GeneratedBackupCodes {
  const plaintextCodes: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw = "";
    for (let j = 0; j < 10; j++) raw += randomAlphabetChar();
    plaintextCodes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return { plaintextCodes, hashes: plaintextCodes.map(hashBackupCode) };
}

export function hashBackupCodeForLookup(code: string): string {
  return hashBackupCode(code);
}

// Used only to obscure timing/format differences between "not a TOTP code"
// and "not a backup code" when the MFA verify endpoint decides which check
// to run — not a cryptographic requirement, just avoids an obvious tell.
export function looksLikeTotpCode(input: string): boolean {
  return /^\d{6}$/.test(input.trim());
}

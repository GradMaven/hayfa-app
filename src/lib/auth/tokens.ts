import { randomBytes, createHash } from "crypto";

// Opaque bearer tokens (session cookies, password-reset links, email-verify
// links) — never JWTs. We store only the SHA-256 hash; the raw token exists
// solely in the client's cookie/URL, so a DB read never reveals a usable
// credential (matches the "don't store passwords directly" principle from
// §13, extended to every other bearer secret in the system).
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

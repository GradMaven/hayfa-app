import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Deliberately permissive on character set (no forced "must contain a symbol"
// rules — those push users toward predictable substitutions). Length is what
// actually matters for resistance to guessing.
export function isPasswordStrongEnough(plain: string): boolean {
  return plain.length >= 10;
}

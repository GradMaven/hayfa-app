import { db } from "@/lib/db";
import { generateOpaqueToken, hashToken } from "./tokens";
import type { MfaChallenge } from "@prisma/client";

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

// The gap between "password correct" and "session issued" (§13/§90). No
// Session row, no cookie that grants any data access, exists until this is
// satisfied — see docs/security-architecture.md.
export async function createMfaChallenge(userId: string): Promise<{ rawToken: string; challenge: MfaChallenge }> {
  const rawToken = generateOpaqueToken();
  const challenge = await db.mfaChallenge.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  return { rawToken, challenge };
}

export interface ChallengeCheckResult {
  ok: boolean;
  challenge?: MfaChallenge;
  reason?: "NOT_FOUND" | "EXPIRED" | "TOO_MANY_ATTEMPTS";
}

export async function loadValidChallenge(rawToken: string): Promise<ChallengeCheckResult> {
  const challenge = await db.mfaChallenge.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!challenge) return { ok: false, reason: "NOT_FOUND" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "EXPIRED" };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "TOO_MANY_ATTEMPTS" };
  return { ok: true, challenge };
}

export async function recordFailedAttempt(challengeId: string): Promise<void> {
  await db.mfaChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
}

export async function consumeChallenge(challengeId: string): Promise<void> {
  // One-shot: delete on success so the same challenge token can't be reused.
  await db.mfaChallenge.delete({ where: { id: challengeId } });
}

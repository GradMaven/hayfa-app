import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { mfaVerifySchema } from "@/lib/validation/mfa";
import { getMfaChallengeTokenFromCookies, clearMfaChallengeCookie, setSessionCookie } from "@/lib/auth/cookies";
import { loadValidChallenge, recordFailedAttempt, consumeChallenge } from "@/lib/auth/mfa-challenge";
import { verifyTotpCode, looksLikeTotpCode, hashBackupCodeForLookup } from "@/lib/auth/mfa";
import { createSession } from "@/lib/auth/session";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { writeAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

// Completes a sign-in that stopped at "password verified, MFA pending" (see
// /api/v1/auth/signin). This is the only place a real Session gets created
// for an MFA-enabled account.
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    if (!checkRateLimit(`mfa-verify:${ipAddress ?? "unknown"}`, 15, 5 * 60 * 1000)) {
      throw new ApiException("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");
    }

    const challengeToken = await getMfaChallengeTokenFromCookies();
    if (!challengeToken) {
      throw new ApiException("UNAUTHENTICATED", "Your sign-in session has expired. Please sign in again.");
    }

    const { code } = mfaVerifySchema.parse(await request.json());

    const check = await loadValidChallenge(challengeToken);
    if (!check.ok || !check.challenge) {
      await clearMfaChallengeCookie();
      throw new ApiException(
        "UNAUTHENTICATED",
        check.reason === "TOO_MANY_ATTEMPTS"
          ? "Too many incorrect attempts. Please sign in again."
          : "Your sign-in session has expired. Please sign in again."
      );
    }
    const { challenge } = check;

    const user = await db.user.findUnique({ where: { id: challenge.userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret || user.status !== "ACTIVE" || user.deletedAt) {
      await clearMfaChallengeCookie();
      throw new ApiException("UNAUTHENTICATED", "Please sign in again.");
    }

    const verified = looksLikeTotpCode(code)
      ? verifyTotpCode(user.mfaSecret, user.email ?? user.id, code)
      : await tryConsumeBackupCode(user.id, code);

    if (!verified) {
      await recordFailedAttempt(challenge.id);
      await writeAuditEvent({
        actorUserId: user.id,
        actorLabel: user.name,
        action: "MFA_VERIFY_FAILED",
        resourceType: "User",
        resourceId: user.id,
        ipAddress,
        userAgent,
      });
      throw new ApiException("UNAUTHENTICATED", "Incorrect code. Please try again.");
    }

    await consumeChallenge(challenge.id);
    await clearMfaChallengeCookie();

    const { rawToken } = await createSession(user.id, { ipAddress, userAgent });
    await setSessionCookie(rawToken);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "SIGNIN_SUCCESS_MFA",
      resourceType: "User",
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    return apiSuccess({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
}

async function tryConsumeBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashBackupCodeForLookup(code);
  // Atomic: only succeeds if the code exists, belongs to this user, and
  // hasn't been used yet — updateMany's count tells us which happened
  // without a separate read-then-write race.
  const result = await db.mfaBackupCode.updateMany({
    where: { userId, codeHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}

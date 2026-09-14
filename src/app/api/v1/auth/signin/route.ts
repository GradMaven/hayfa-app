import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { signInSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie, setMfaChallengeCookie } from "@/lib/auth/cookies";
import { createMfaChallenge } from "@/lib/auth/mfa-challenge";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { writeAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const body = await request.json();
    const input = signInSchema.parse(body);
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    // Keyed on IP+email so one guessed password against many accounts and
    // many guesses against one account are both throttled.
    if (!checkRateLimit(`signin:${ipAddress ?? "unknown"}:${input.email}`, 8, 5 * 60 * 1000)) {
      throw new ApiException("RATE_LIMITED", "Too many sign-in attempts. Please wait a few minutes and try again.");
    }

    const user = await db.user.findUnique({ where: { email: input.email } });

    // Same generic message whether the email doesn't exist or the password
    // is wrong — never confirm which one failed.
    const genericFailure = () => new ApiException("UNAUTHENTICATED", "Incorrect email or password.");

    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      throw genericFailure();
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await writeAuditEvent({
        actorUserId: user.id,
        actorLabel: user.name,
        action: "SIGNIN_FAILED",
        resourceType: "User",
        resourceId: user.id,
        ipAddress,
        userAgent,
      });
      throw genericFailure();
    }

    // Password is correct. If MFA is enabled, stop here — no Session is
    // created, only a short-lived challenge. See docs/security-architecture.md.
    if (user.mfaEnabled) {
      const { rawToken: challengeToken } = await createMfaChallenge(user.id);
      await setMfaChallengeCookie(challengeToken);

      await writeAuditEvent({
        actorUserId: user.id,
        actorLabel: user.name,
        action: "SIGNIN_PASSWORD_VERIFIED_MFA_PENDING",
        resourceType: "User",
        resourceId: user.id,
        ipAddress,
        userAgent,
      });

      return apiSuccess({ mfaRequired: true });
    }

    const { rawToken } = await createSession(user.id, { ipAddress, userAgent });
    await setSessionCookie(rawToken);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "SIGNIN_SUCCESS",
      resourceType: "User",
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    return apiSuccess({ mfaRequired: false, id: user.id, name: user.name, email: user.email, role: user.role });
  });
}

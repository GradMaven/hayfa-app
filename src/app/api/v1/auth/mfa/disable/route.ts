import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { mfaDisableSchema } from "@/lib/validation/mfa";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotpCode, looksLikeTotpCode, hashBackupCodeForLookup } from "@/lib/auth/mfa";
import { revokeAllOtherSessions } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// Disabling 2FA is a security-lowering action, so it requires re-proving
// BOTH factors — password AND a current code — not just an authenticated
// session (someone who only stole a live session cookie can't turn this
// off). Also revokes every other session, the same hygiene a password reset
// gets, since this changes the account's risk profile.
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { password, code } = mfaDisableSchema.parse(await request.json());

    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!dbUser.mfaEnabled || !dbUser.mfaSecret) {
      throw new ApiException("CONFLICT", "Two-factor authentication is not currently enabled.");
    }

    const passwordValid = await verifyPassword(password, dbUser.passwordHash);
    if (!passwordValid) {
      throw new ApiException("UNAUTHENTICATED", "Incorrect password.");
    }

    const codeValid = looksLikeTotpCode(code)
      ? verifyTotpCode(dbUser.mfaSecret, dbUser.email ?? dbUser.id, code)
      : await hasUnusedBackupCode(user.id, code);
    if (!codeValid) {
      throw new ApiException("VALIDATION_ERROR", "Incorrect code.");
    }

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } }),
      db.mfaBackupCode.deleteMany({ where: { userId: user.id } }),
    ]);

    await revokeAllOtherSessions(user.id, user.sessionId);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "MFA_DISABLED",
      resourceType: "User",
      resourceId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ enabled: false });
  });
}

async function hasUnusedBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashBackupCodeForLookup(code);
  const match = await db.mfaBackupCode.findFirst({ where: { userId, codeHash, usedAt: null } });
  return Boolean(match);
}

import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { mfaEnrollConfirmSchema } from "@/lib/validation/mfa";
import { verifyTotpCode, generateBackupCodes } from "@/lib/auth/mfa";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// Proves the user's authenticator app actually has the secret from
// /enroll/start before MFA is required on future sign-ins — never flip
// mfaEnabled on the strength of "we generated a secret," only on "they
// demonstrated they can produce a valid code from it."
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { code } = mfaEnrollConfirmSchema.parse(await request.json());

    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (dbUser.mfaEnabled) {
      throw new ApiException("CONFLICT", "Two-factor authentication is already enabled.");
    }
    if (!dbUser.mfaSecret) {
      throw new ApiException("CONFLICT", "Start enrollment first.");
    }

    const valid = verifyTotpCode(dbUser.mfaSecret, dbUser.email ?? dbUser.id, code);
    if (!valid) {
      throw new ApiException("VALIDATION_ERROR", "That code didn't match. Check your authenticator app and try again.");
    }

    const { plaintextCodes, hashes } = generateBackupCodes();

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { mfaEnabled: true } }),
      db.mfaBackupCode.createMany({ data: hashes.map((codeHash) => ({ userId: user.id, codeHash })) }),
    ]);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "MFA_ENABLED",
      resourceType: "User",
      resourceId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    // The only moment these plaintext codes ever exist outside the user's
    // own record of them — never returned or logged again after this.
    return apiSuccess({ enabled: true, backupCodes: plaintextCodes });
  });
}

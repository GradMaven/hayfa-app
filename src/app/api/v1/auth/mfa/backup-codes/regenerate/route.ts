import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { mfaRegenerateBackupCodesSchema } from "@/lib/validation/mfa";
import { verifyTotpCode, generateBackupCodes } from "@/lib/auth/mfa";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// Invalidates every existing backup code and issues a fresh set — the
// correct response to "I think my old codes may have leaked" or simply
// running low. Requires a current TOTP code, not just an active session.
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { code } = mfaRegenerateBackupCodesSchema.parse(await request.json());

    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!dbUser.mfaEnabled || !dbUser.mfaSecret) {
      throw new ApiException("CONFLICT", "Two-factor authentication is not currently enabled.");
    }

    const valid = verifyTotpCode(dbUser.mfaSecret, dbUser.email ?? dbUser.id, code);
    if (!valid) {
      throw new ApiException("VALIDATION_ERROR", "Incorrect code.");
    }

    const { plaintextCodes, hashes } = generateBackupCodes();

    await db.$transaction([
      db.mfaBackupCode.deleteMany({ where: { userId: user.id } }),
      db.mfaBackupCode.createMany({ data: hashes.map((codeHash) => ({ userId: user.id, codeHash })) }),
    ]);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "MFA_BACKUP_CODES_REGENERATED",
      resourceType: "User",
      resourceId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ backupCodes: plaintextCodes });
  });
}

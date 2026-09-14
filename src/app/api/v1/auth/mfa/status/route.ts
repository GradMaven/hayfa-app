import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";

export async function GET() {
  return withApiErrors(async () => {
    const user = await requireUser();

    const [dbUser, backupCodesRemaining] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: user.id }, select: { mfaEnabled: true } }),
      db.mfaBackupCode.count({ where: { userId: user.id, usedAt: null } }),
    ]);

    return apiSuccess({ enabled: dbUser.mfaEnabled, backupCodesRemaining });
  });
}

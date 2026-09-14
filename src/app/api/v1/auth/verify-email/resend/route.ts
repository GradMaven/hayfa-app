import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditEvent } from "@/lib/audit";

export async function POST() {
  return withApiErrors(async () => {
    const user = await requireUser();

    if (user.emailVerified) {
      return apiSuccess({ sent: false, alreadyVerified: true });
    }
    if (!user.email) {
      throw new ApiException("CONFLICT", "No email address is on file for this account.");
    }

    if (!checkRateLimit(`verify-email-resend:${user.id}`, 3, 15 * 60 * 1000)) {
      throw new ApiException("RATE_LIMITED", "Too many requests. Please wait a few minutes and try again.");
    }

    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, email: true } });
    await sendVerificationEmail(dbUser);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "EMAIL_VERIFICATION_REQUESTED",
      resourceType: "User",
      resourceId: user.id,
    });

    return apiSuccess({ sent: true, alreadyVerified: false });
  });
}

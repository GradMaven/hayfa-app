import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { verifyEmailConfirmSchema } from "@/lib/validation/auth";
import { hashToken } from "@/lib/auth/tokens";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// Deliberately NOT behind requireUser() — the link is opened from an email
// client that may not share a session with the app (different browser,
// different device), same reasoning as reset-password. The token itself is
// the proof of access to the mailbox; that's the whole point of the flow.
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const { token } = verifyEmailConfirmSchema.parse(await request.json());

    const tokenHash = hashToken(token);
    const verificationToken = await db.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { email: true } } },
    });

    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
      throw new ApiException("VALIDATION_ERROR", "This verification link is invalid or has expired.");
    }

    await db.$transaction([
      db.user.update({ where: { id: verificationToken.userId }, data: { emailVerifiedAt: new Date() } }),
      db.emailVerificationToken.update({ where: { id: verificationToken.id }, data: { usedAt: new Date() } }),
    ]);

    await writeAuditEvent({
      actorUserId: verificationToken.userId,
      action: "EMAIL_VERIFIED",
      resourceType: "User",
      resourceId: verificationToken.userId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ verified: true, email: verificationToken.user.email });
  });
}

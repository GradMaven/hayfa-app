import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const body = await request.json();
    const input = resetPasswordSchema.parse(body);

    const tokenHash = hashToken(input.token);
    const resetToken = await db.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new ApiException("VALIDATION_ERROR", "This password reset link is invalid or has expired.");
    }

    const passwordHash = await hashPassword(input.newPassword);

    await db.$transaction([
      db.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      db.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      // A password reset invalidates every existing session — if the reset
      // was triggered by account compromise, this locks the attacker out too.
      db.session.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await writeAuditEvent({
      actorUserId: resetToken.userId,
      action: "PASSWORD_RESET",
      resourceType: "User",
      resourceId: resetToken.userId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ reset: true });
  });
}

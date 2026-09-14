import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-context";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const ipAddress = getClientIp(request);
    const body = await request.json();
    const input = requestPasswordResetSchema.parse(body);

    if (!checkRateLimit(`reset:${ipAddress ?? "unknown"}:${input.email}`, 5, 15 * 60 * 1000)) {
      // Still return success below — do not reveal rate-limit state to a
      // possible attacker enumerating emails.
      return apiSuccess({ requested: true });
    }

    const user = await db.user.findUnique({ where: { email: input.email } });

    // Always respond identically whether or not the account exists — this is
    // the one place §13/§91 collide with "helpful UX": being vague here is
    // the correct choice.
    if (user && user.status === "ACTIVE" && !user.deletedAt) {
      const rawToken = generateOpaqueToken();
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password?token=${rawToken}`;
      if (process.env.EMAIL_PROVIDER === "console") {
        console.info(`[email:mock] Password reset for ${user.email}: ${resetUrl}`);
      }
    }

    return apiSuccess({ requested: true });
  });
}

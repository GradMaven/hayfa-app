import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-context";
import { getEmailProvider } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email/templates";

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
    if (user && user.status === "ACTIVE" && !user.deletedAt && user.email) {
      const rawToken = generateOpaqueToken();
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password?token=${rawToken}`;
      const { subject, html, text } = passwordResetEmail({ name: user.name, resetUrl });

      try {
        await getEmailProvider().send({ to: user.email, subject, html, text });
      } catch (err) {
        // Never let an email-delivery failure change this endpoint's
        // response (would reveal account existence via a distinguishable
        // error) or block the request — log server-side and move on. A
        // real deployment should alert on this, not surface it to the caller.
        console.error("[email] failed to send password reset email:", err instanceof Error ? err.message : err);
      }
    }

    return apiSuccess({ requested: true });
  });
}

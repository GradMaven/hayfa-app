import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { signUpSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { writeAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/auth/email-verification";

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const ipAddress = getClientIp(request);
    if (!checkRateLimit(`signup:${ipAddress ?? "unknown"}`, 10, 60 * 60 * 1000)) {
      throw new ApiException("RATE_LIMITED", "Too many sign-up attempts. Please try again later.");
    }

    const body = await request.json();
    const input = signUpSchema.parse(body);

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      // Deliberately vague — do not reveal whether an email is registered.
      throw new ApiException("CONFLICT", "Could not create an account with those details.");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash, role: "PATIENT" },
    });

    const { rawToken } = await createSession(user.id, {
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });
    await setSessionCookie(rawToken);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "ACCOUNT_CREATED",
      resourceType: "User",
      resourceId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    await sendVerificationEmail(user);

    return apiSuccess(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      undefined,
      201
    );
  });
}

import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { providerSignUpSchema } from "@/lib/validation/provider";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { writeAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

// A distinct route from POST /api/v1/auth/signup, not a `role` field on it —
// accepting a client-suppliable role on the general signup endpoint would be
// a privilege-escalation footgun. This route always creates role: "PROVIDER"
// and verificationStatus: "PENDING"; there is no path, here or anywhere else
// client-reachable, that creates a VERIFIED provider or any admin role — see
// docs/admin-architecture.md. A pending provider can sign in and use the
// portal immediately (same non-blocking philosophy as email verification —
// see docs/security-architecture.md), but every write they make is tagged
// verificationStatus: UNVERIFIED (sourceForActor/verificationForActor in
// lib/api/patient-scope.ts) until an admin approves them.
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const ipAddress = getClientIp(request);
    if (!checkRateLimit(`provider-signup:${ipAddress ?? "unknown"}`, 10, 60 * 60 * 1000)) {
      throw new ApiException("RATE_LIMITED", "Too many sign-up attempts. Please try again later.");
    }

    const body = await request.json();
    const input = providerSignUpSchema.parse(body);
    const phone = input.phone || undefined;
    const organizationId = input.organizationId || undefined;

    const existing = await db.user.findFirst({
      where: { OR: [{ email: input.email }, ...(phone ? [{ phone }] : [])] },
    });
    if (existing) {
      // Deliberately vague — do not reveal whether an email or phone is registered.
      throw new ApiException("CONFLICT", "Could not create an account with those details.");
    }

    if (organizationId) {
      const org = await db.organization.findUnique({ where: { id: organizationId }, select: { deletedAt: true } });
      if (!org || org.deletedAt) {
        throw new ApiException("VALIDATION_ERROR", "That organization could not be found.");
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await db.user.create({
      data: { name: input.name, email: input.email, phone, passwordHash, role: "PROVIDER" },
    });
    const provider = await db.healthcareProvider.create({
      data: {
        userId: user.id,
        organizationId,
        fullName: input.name,
        specialty: input.specialty,
        licenseNumber: input.licenseNumber,
        verificationStatus: "PENDING",
      },
    });

    const { rawToken } = await createSession(user.id, {
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });
    await setSessionCookie(rawToken);

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "PROVIDER_REGISTERED",
      resourceType: "HealthcareProvider",
      resourceId: provider.id,
      metadata: { licenseNumber: input.licenseNumber, specialty: input.specialty ?? null },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess(
      { id: user.id, name: user.name, email: user.email, role: user.role, verificationStatus: provider.verificationStatus },
      undefined,
      201
    );
  });
}

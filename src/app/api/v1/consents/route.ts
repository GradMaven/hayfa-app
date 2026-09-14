import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { resolvePatientId } from "@/lib/api/patient-scope";
import { createConsentSchema } from "@/lib/validation/consent";
import { expireStaleConsents } from "@/lib/consent";
import { notify } from "@/lib/notifications";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

const DURATION_TO_MS: Record<string, number | null> = {
  ONE_TIME: null,
  HOURS_24: 24 * 60 * 60 * 1000,
  DAYS_7: 7 * 24 * 60 * 60 * 1000,
  DAYS_30: 30 * 24 * 60 * 60 * 1000,
  UNTIL_REVOKED: null,
};

// Only the patient who owns the record can list/create consents for it —
// this is intentionally NOT routed through canAccess() (which is for
// *consuming* a grant); granting access is an owner-only action.
export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    if (patientId !== actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Only the patient can manage sharing for their own record.");
    }

    await expireStaleConsents(patientId);
    const consents = await db.consent.findMany({
      where: { patientId },
      orderBy: { grantedAt: "desc" },
    });
    return apiSuccess(consents);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    if (patientId !== actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Only the patient can grant access to their own record.");
    }

    const input = createConsentSchema.parse(body);

    const recipient = await db.user.findUnique({ where: { email: input.recipientEmail } });
    if (!recipient) {
      throw new ApiException(
        "NOT_FOUND",
        "No Hafya account found for that email. Ask them to create an account first."
      );
    }
    if (recipient.id === actor.id) {
      throw new ApiException("VALIDATION_ERROR", "You cannot grant access to yourself.");
    }

    const durationMs = DURATION_TO_MS[input.duration];
    const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;

    const consent = await db.consent.create({
      data: {
        patientId,
        recipientType: input.recipientType,
        recipientUserId: recipient.id,
        recipientLabel: recipient.name,
        purpose: input.purpose,
        dataScopes: input.dataScopes,
        duration: input.duration,
        expiresAt,
        status: "ACTIVE",
      },
    });

    await writeAuditEvent({
      actorUserId: actor.id,
      actorLabel: actor.name,
      action: "CONSENT_GRANTED",
      resourceType: "Consent",
      resourceId: consent.id,
      patientId,
      metadata: { recipientLabel: recipient.name, dataScopes: input.dataScopes, duration: input.duration },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    await notify({
      userId: recipient.id,
      type: "CONSENT",
      title: "You've been granted access to a patient record",
      body: `${actor.name} shared: ${input.dataScopes.join(", ")}.`,
      relatedEntityType: "Consent",
      relatedEntityId: consent.id,
    });

    return apiSuccess(consent, undefined, 201);
  });
}

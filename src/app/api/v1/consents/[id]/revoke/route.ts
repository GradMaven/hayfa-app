import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { revokeConsentSchema } from "@/lib/validation/consent";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { notify } from "@/lib/notifications";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const { id } = await params;

    const consent = await db.consent.findUnique({ where: { id } });
    if (!consent) throw new ApiException("NOT_FOUND", "Consent not found.");
    if (consent.patientId !== actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Only the patient can revoke access to their own record.");
    }
    if (consent.status !== "ACTIVE") {
      throw new ApiException("CONFLICT", "This access grant is already inactive.");
    }

    const body = await request.json().catch(() => ({}));
    const input = revokeConsentSchema.parse(body);

    const updated = await db.consent.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date(), revocationReason: input.reason },
    });

    await writeAuditEvent({
      actorUserId: actor.id,
      actorLabel: actor.name,
      action: "CONSENT_REVOKED",
      resourceType: "Consent",
      resourceId: id,
      patientId: consent.patientId,
      metadata: { recipientLabel: consent.recipientLabel, reason: input.reason },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (consent.recipientUserId) {
      await notify({
        userId: consent.recipientUserId,
        type: "CONSENT",
        title: "Access to a patient record was removed",
        body: `${actor.name} revoked your access.`,
        relatedEntityType: "Consent",
        relatedEntityId: id,
      });
    }

    return apiSuccess(updated);
  });
}

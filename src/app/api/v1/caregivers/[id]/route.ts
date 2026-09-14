import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const { id } = await params;

    const link = await db.caregiverLink.findUnique({ where: { id } });
    if (!link) throw new ApiException("NOT_FOUND", "Caregiver link not found.");
    if (link.patientId !== actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Only the patient can remove a caregiver's access.");
    }

    await db.caregiverLink.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });

    await writeAuditEvent({
      actorUserId: actor.id,
      actorLabel: actor.name,
      action: "CAREGIVER_REMOVED",
      resourceType: "CaregiverLink",
      resourceId: id,
      patientId: link.patientId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ revoked: true });
  });
}

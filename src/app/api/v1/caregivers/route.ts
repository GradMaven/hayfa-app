import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { caregiverInviteSchema } from "@/lib/validation/consent";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { notify } from "@/lib/notifications";

export async function GET() {
  return withApiErrors(async () => {
    const actor = await requireUser();
    if (!actor.patientProfileId) return apiSuccess([]);

    const links = await db.caregiverLink.findMany({
      where: { patientId: actor.patientProfileId },
      orderBy: { createdAt: "desc" },
      include: { caregiverUser: { select: { name: true, email: true } } },
    });
    return apiSuccess(links);
  });
}

// Requires the caregiver to already have a Hafya account — no separate
// invite-by-email-token flow in this phase (documented scope cut, see
// docs/discovery-report.md). A real invite flow is a small, well-scoped
// Phase 2 addition on top of the same CaregiverLink model.
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    if (!actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Complete your health profile first.");
    }

    const body = await request.json();
    const input = caregiverInviteSchema.parse(body);

    const caregiverUser = await db.user.findUnique({ where: { email: input.caregiverEmail } });
    if (!caregiverUser) {
      throw new ApiException(
        "NOT_FOUND",
        "No Hafya account found for that email. Ask them to create an account first."
      );
    }
    if (caregiverUser.id === actor.id) {
      throw new ApiException("VALIDATION_ERROR", "You cannot add yourself as a caregiver.");
    }

    const link = await db.caregiverLink.upsert({
      where: { patientId_caregiverUserId: { patientId: actor.patientProfileId, caregiverUserId: caregiverUser.id } },
      update: { permissions: input.permissions, relationship: input.relationship, status: "ACTIVE", revokedAt: null },
      create: {
        patientId: actor.patientProfileId,
        caregiverUserId: caregiverUser.id,
        relationship: input.relationship,
        permissions: input.permissions,
        status: "ACTIVE",
      },
    });

    await writeAuditEvent({
      actorUserId: actor.id,
      actorLabel: actor.name,
      action: "CAREGIVER_ADDED",
      resourceType: "CaregiverLink",
      resourceId: link.id,
      patientId: actor.patientProfileId,
      metadata: { caregiverEmail: input.caregiverEmail, permissions: input.permissions },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    await notify({
      userId: caregiverUser.id,
      type: "ACCESS",
      title: "You've been added as a caregiver",
      body: `${actor.name} gave you caregiver access to view: ${input.permissions.join(", ")}.`,
      relatedEntityType: "CaregiverLink",
      relatedEntityId: link.id,
    });

    return apiSuccess(link, undefined, 201);
  });
}

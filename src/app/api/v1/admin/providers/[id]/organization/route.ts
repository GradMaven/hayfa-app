import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";
import { assignOrganizationSchema } from "@/lib/validation/organization";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// Separate from /verify and /reject — assigning an organization is
// independent of the verification decision (an admin may need to correct
// or add an affiliation for an already-verified provider, or leave a
// pending one unassigned). organizationId: null clears the affiliation.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const admin = await requireRole("SUPER_ADMIN");
    const { id } = await params;
    const body = await request.json();
    const { organizationId } = assignOrganizationSchema.parse(body);

    const provider = await db.healthcareProvider.findUnique({ where: { id } });
    if (!provider) throw new ApiException("NOT_FOUND", "Provider registration not found.");

    if (organizationId) {
      const org = await db.organization.findUnique({ where: { id: organizationId }, select: { deletedAt: true } });
      if (!org || org.deletedAt) throw new ApiException("VALIDATION_ERROR", "That organization could not be found.");
    }

    const updated = await db.healthcareProvider.update({
      where: { id },
      data: { organizationId },
      include: { organization: { select: { name: true } } },
    });

    await writeAuditEvent({
      actorUserId: admin.id,
      actorLabel: admin.name,
      action: "PROVIDER_ORGANIZATION_ASSIGNED",
      resourceType: "HealthcareProvider",
      resourceId: id,
      metadata: { organizationId, previousOrganizationId: provider.organizationId },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ id: updated.id, organizationId: updated.organizationId, organizationName: updated.organization?.name ?? null });
  });
}

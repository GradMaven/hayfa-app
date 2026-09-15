import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";
import { organizationUpdateSchema } from "@/lib/validation/organization";
import { pickProvidedFields } from "@/lib/validation/partial-update";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

async function loadOrganization(id: string) {
  const org = await db.organization.findUnique({ where: { id } });
  if (!org || org.deletedAt) throw new ApiException("NOT_FOUND", "Organization not found.");
  return org;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const admin = await requireRole("SUPER_ADMIN");
    const { id } = await params;
    await loadOrganization(id);

    const body = await request.json();
    const input = pickProvidedFields(organizationUpdateSchema.parse(body), body);

    const updated = await db.organization.update({ where: { id }, data: input });

    await writeAuditEvent({
      actorUserId: admin.id,
      actorLabel: admin.name,
      action: "ORGANIZATION_UPDATED",
      resourceType: "Organization",
      resourceId: id,
      metadata: { fields: Object.keys(input) },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess(updated);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const admin = await requireRole("SUPER_ADMIN");
    const { id } = await params;
    const org = await loadOrganization(id);

    await db.organization.update({ where: { id }, data: { deletedAt: new Date() } });

    await writeAuditEvent({
      actorUserId: admin.id,
      actorLabel: admin.name,
      action: "ORGANIZATION_DELETED",
      resourceType: "Organization",
      resourceId: id,
      metadata: { name: org.name },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ deleted: true });
  });
}

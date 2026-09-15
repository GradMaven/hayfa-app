import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";
import { providerRejectSchema } from "@/lib/validation/provider";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { notify } from "@/lib/notifications";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const admin = await requireRole("SUPER_ADMIN");
    const { id } = await params;
    const body = await request.json();
    const { reason } = providerRejectSchema.parse(body);

    const provider = await db.healthcareProvider.findUnique({ where: { id } });
    if (!provider) throw new ApiException("NOT_FOUND", "Provider registration not found.");

    const updated = await db.healthcareProvider.update({
      where: { id },
      data: { verificationStatus: "REJECTED" },
    });

    await writeAuditEvent({
      actorUserId: admin.id,
      actorLabel: admin.name,
      action: "PROVIDER_REJECTED",
      resourceType: "HealthcareProvider",
      resourceId: id,
      metadata: { licenseNumber: provider.licenseNumber, reason, previousStatus: provider.verificationStatus },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    await notify({
      userId: provider.userId,
      type: "SECURITY",
      title: "Your provider verification was not approved",
      body: reason,
    });

    return apiSuccess({ id: updated.id, verificationStatus: updated.verificationStatus });
  });
}

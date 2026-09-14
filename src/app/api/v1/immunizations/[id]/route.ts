import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const record = await db.immunization.findUnique({ where: { id }, select: { patientId: true, deletedAt: true } });
    if (!record || record.deletedAt) throw new ApiException("NOT_FOUND", "Immunization not found.");

    await authorizePatientAccess(request, { patientId: record.patientId, scope: "IMMUNIZATIONS", action: "DELETE", resourceType: "Immunization", resourceId: id });
    await db.immunization.update({ where: { id }, data: { deletedAt: new Date() } });
    return apiSuccess({ deleted: true });
  });
}

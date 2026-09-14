import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";

// Vitals are point-in-time measurements — intentionally no PATCH. A wrong
// entry is deleted (soft) and re-recorded, which keeps the audit trail
// honest instead of silently rewriting a measurement after the fact.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const record = await db.vital.findUnique({ where: { id }, select: { patientId: true, deletedAt: true } });
    if (!record || record.deletedAt) throw new ApiException("NOT_FOUND", "Vital record not found.");

    await authorizePatientAccess(request, { patientId: record.patientId, scope: "VITALS", action: "DELETE", resourceType: "Vital", resourceId: id });
    await db.vital.update({ where: { id }, data: { deletedAt: new Date() } });
    return apiSuccess({ deleted: true });
  });
}

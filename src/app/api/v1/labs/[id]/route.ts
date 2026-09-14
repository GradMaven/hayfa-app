import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";
import { labResultSchema } from "@/lib/validation/clinical";

async function loadOwnerPatientId(id: string): Promise<string> {
  const record = await db.labResult.findUnique({ where: { id }, select: { patientId: true, deletedAt: true } });
  if (!record || record.deletedAt) throw new ApiException("NOT_FOUND", "Lab result not found.");
  return record.patientId;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const patientId = await loadOwnerPatientId(id);
    await authorizePatientAccess(request, { patientId, scope: "LAB_RESULTS", action: "UPDATE", resourceType: "LabResult", resourceId: id });

    const body = await request.json();
    const input = labResultSchema.partial().parse(body);
    const record = await db.labResult.update({ where: { id }, data: input });
    return apiSuccess(record);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const patientId = await loadOwnerPatientId(id);
    await authorizePatientAccess(request, { patientId, scope: "LAB_RESULTS", action: "DELETE", resourceType: "LabResult", resourceId: id });

    await db.labResult.update({ where: { id }, data: { deletedAt: new Date() } });
    return apiSuccess({ deleted: true });
  });
}

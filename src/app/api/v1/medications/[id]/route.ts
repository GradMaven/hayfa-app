import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, assertDirectEditAllowed } from "@/lib/api/patient-scope";
import { medicationSchema } from "@/lib/validation/clinical";
import { pickProvidedFields } from "@/lib/validation/partial-update";

async function loadOwnerRecord(id: string) {
  const record = await db.medication.findUnique({
    where: { id },
    select: { patientId: true, deletedAt: true, source: true, verificationStatus: true },
  });
  if (!record || record.deletedAt) throw new ApiException("NOT_FOUND", "Medication not found.");
  return record;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const existing = await loadOwnerRecord(id);
    await authorizePatientAccess(request, {
      patientId: existing.patientId,
      scope: "MEDICATIONS",
      action: "UPDATE",
      resourceType: "Medication",
      resourceId: id,
    });
    assertDirectEditAllowed(existing);

    const body = await request.json();
    const input = pickProvidedFields(medicationSchema.partial().parse(body), body);
    const record = await db.medication.update({ where: { id }, data: input });
    return apiSuccess(record);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const existing = await loadOwnerRecord(id);
    await authorizePatientAccess(request, {
      patientId: existing.patientId,
      scope: "MEDICATIONS",
      action: "DELETE",
      resourceType: "Medication",
      resourceId: id,
    });

    // Soft delete only — clinical records are never hard-deleted (§32/§79).
    await db.medication.update({ where: { id }, data: { deletedAt: new Date() } });
    return apiSuccess({ deleted: true });
  });
}

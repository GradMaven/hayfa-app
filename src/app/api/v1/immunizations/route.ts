import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId, sourceForActor, verificationForActor } from "@/lib/api/patient-scope";
import { immunizationSchema } from "@/lib/validation/clinical";
import { recordHealthEvent } from "@/lib/health-events";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "IMMUNIZATIONS", action: "VIEW", resourceType: "Immunization" });

    const records = await db.immunization.findMany({ where: { patientId, deletedAt: null }, orderBy: { administeredDate: "desc" } });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "IMMUNIZATIONS", action: "CREATE", resourceType: "Immunization" });

    const input = immunizationSchema.parse(body);
    const record = await db.immunization.create({
      data: { patientId, ...input, source: sourceForActor(actor), verificationStatus: verificationForActor(actor) },
    });

    await recordHealthEvent({
      patientId,
      type: "IMMUNIZATION",
      title: `Immunization: ${record.vaccineName}`,
      eventDate: record.administeredDate,
      sourceEntityType: "Immunization",
      sourceEntityId: record.id,
    });

    return apiSuccess(record, undefined, 201);
  });
}

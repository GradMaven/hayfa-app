import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId, sourceForActor, verificationForActor } from "@/lib/api/patient-scope";
import { vitalSchema } from "@/lib/validation/clinical";
import { recordHealthEvent } from "@/lib/health-events";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "VITALS", action: "VIEW", resourceType: "Vital" });

    const type = request.nextUrl.searchParams.get("type");
    const records = await db.vital.findMany({
      where: { patientId, deletedAt: null, ...(type ? { type: type as never } : {}) },
      orderBy: { recordedAt: "desc" },
      take: 200,
    });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "VITALS", action: "CREATE", resourceType: "Vital" });

    const input = vitalSchema.parse(body);
    const record = await db.vital.create({
      data: { patientId, ...input, source: sourceForActor(actor), verificationStatus: verificationForActor(actor) },
    });

    await recordHealthEvent({
      patientId,
      type: "VITAL",
      title: `${record.type.replace(/_/g, " ")} recorded: ${record.value}${record.secondaryValue ? `/${record.secondaryValue}` : ""} ${record.unit}`,
      eventDate: record.recordedAt,
      sourceEntityType: "Vital",
      sourceEntityId: record.id,
    });

    return apiSuccess(record, undefined, 201);
  });
}

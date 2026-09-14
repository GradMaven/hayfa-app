import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId, sourceForActor, verificationForActor } from "@/lib/api/patient-scope";
import { labResultSchema } from "@/lib/validation/clinical";
import { recordHealthEvent } from "@/lib/health-events";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "LAB_RESULTS", action: "VIEW", resourceType: "LabResult" });

    const testName = request.nextUrl.searchParams.get("testName");
    const records = await db.labResult.findMany({
      where: { patientId, deletedAt: null, ...(testName ? { testName } : {}) },
      orderBy: { testDate: "desc" },
    });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "LAB_RESULTS", action: "CREATE", resourceType: "LabResult" });

    const input = labResultSchema.parse(body);
    const record = await db.labResult.create({
      data: { patientId, ...input, source: sourceForActor(actor), verificationStatus: verificationForActor(actor) },
    });

    await recordHealthEvent({
      patientId,
      type: "LAB",
      title: `Lab result: ${record.testName} ${record.resultValue}${record.unit ?? ""}`,
      eventDate: record.testDate,
      sourceEntityType: "LabResult",
      sourceEntityId: record.id,
    });

    return apiSuccess(record, undefined, 201);
  });
}

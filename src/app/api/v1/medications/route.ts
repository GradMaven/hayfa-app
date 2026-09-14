import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId, sourceForActor, verificationForActor } from "@/lib/api/patient-scope";
import { medicationSchema } from "@/lib/validation/clinical";
import { recordHealthEvent } from "@/lib/health-events";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "MEDICATIONS", action: "VIEW", resourceType: "Medication" });

    const status = request.nextUrl.searchParams.get("status");
    const records = await db.medication.findMany({
      where: { patientId, deletedAt: null, ...(status ? { status: status as never } : {}) },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      include: { prescriber: { select: { fullName: true } }, relatedCondition: { select: { name: true } } },
    });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "MEDICATIONS", action: "CREATE", resourceType: "Medication" });

    const input = medicationSchema.parse(body);
    const record = await db.medication.create({
      data: {
        patientId,
        ...input,
        prescriberId: actor.providerProfileId ?? undefined,
        source: sourceForActor(actor),
        verificationStatus: verificationForActor(actor),
      },
    });

    await recordHealthEvent({
      patientId,
      type: "MEDICATION",
      title: `${record.status === "ACTIVE" ? "Started" : "Added"}: ${record.name}${record.dose ? ` ${record.dose}` : ""}`,
      eventDate: record.startDate ?? record.createdAt,
      sourceEntityType: "Medication",
      sourceEntityId: record.id,
    });

    return apiSuccess(record, undefined, 201);
  });
}

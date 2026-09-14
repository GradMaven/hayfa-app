import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId, sourceForActor, verificationForActor } from "@/lib/api/patient-scope";
import { conditionSchema } from "@/lib/validation/clinical";
import { recordHealthEvent } from "@/lib/health-events";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "CONDITIONS", action: "VIEW", resourceType: "Condition" });

    const records = await db.condition.findMany({
      where: { patientId, deletedAt: null },
      orderBy: [{ status: "asc" }, { dateDiagnosed: "desc" }],
      include: { medications: { where: { deletedAt: null }, select: { id: true, name: true } } },
    });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "CONDITIONS", action: "CREATE", resourceType: "Condition" });

    const input = conditionSchema.parse(body);
    const record = await db.condition.create({
      data: {
        patientId,
        ...input,
        providerId: actor.providerProfileId ?? undefined,
        source: sourceForActor(actor),
        verificationStatus: verificationForActor(actor),
      },
    });

    await recordHealthEvent({
      patientId,
      type: "DIAGNOSIS",
      title: `Condition recorded: ${record.name}`,
      eventDate: record.dateDiagnosed ?? record.createdAt,
      sourceEntityType: "Condition",
      sourceEntityId: record.id,
    });

    return apiSuccess(record, undefined, 201);
  });
}

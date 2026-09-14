import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId } from "@/lib/api/patient-scope";
import { carePlanSchema } from "@/lib/validation/clinical";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "CARE_PLANS", action: "VIEW", resourceType: "CarePlan" });

    const records = await db.carePlan.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { status: "asc" },
      include: { condition: { select: { name: true } }, provider: { select: { fullName: true } } },
    });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "CARE_PLANS", action: "CREATE", resourceType: "CarePlan" });

    const input = carePlanSchema.parse(body);
    const record = await db.carePlan.create({
      data: { patientId, ...input, providerId: actor.providerProfileId ?? undefined },
    });
    return apiSuccess(record, undefined, 201);
  });
}

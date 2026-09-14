import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId, sourceForActor, verificationForActor } from "@/lib/api/patient-scope";
import { allergySchema } from "@/lib/validation/clinical";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "ALLERGIES", action: "VIEW", resourceType: "Allergy" });

    const records = await db.allergy.findMany({ where: { patientId, deletedAt: null }, orderBy: { severity: "desc" } });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "ALLERGIES", action: "CREATE", resourceType: "Allergy" });

    const input = allergySchema.parse(body);
    const record = await db.allergy.create({
      data: { patientId, ...input, source: sourceForActor(actor), verificationStatus: verificationForActor(actor) },
    });
    return apiSuccess(record, undefined, 201);
  });
}

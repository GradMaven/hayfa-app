import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { resolvePatientId } from "@/lib/api/patient-scope";
import { writeDataAccessLog } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// Data export / portability (§26, §55). JSON now; a structured
// interoperability format (FHIR Bundle) is a Phase 3 addition once the
// canonical-model mapping work in docs/integration-architecture.md lands —
// the shape below is already close to FHIR resource groupings to make that
// migration additive rather than a rewrite.
export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    if (patientId !== actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Only the patient can export their own record.");
    }

    const where = { patientId, deletedAt: null };
    const [
      profile,
      conditions,
      medications,
      labResults,
      vitals,
      allergies,
      immunizations,
      appointments,
      carePlans,
      documents,
    ] = await Promise.all([
      db.patientProfile.findUnique({ where: { id: patientId } }),
      db.condition.findMany({ where }),
      db.medication.findMany({ where }),
      db.labResult.findMany({ where }),
      db.vital.findMany({ where }),
      db.allergy.findMany({ where }),
      db.immunization.findMany({ where }),
      db.appointment.findMany({ where }),
      db.carePlan.findMany({ where }),
      db.document.findMany({
        where,
        select: { id: true, documentType: true, title: true, documentDate: true, uploadedAt: true, source: true },
      }),
    ]);

    await writeDataAccessLog({
      patientId,
      actorUserId: actor.id,
      actorLabel: actor.name,
      resourceType: "PatientRecord",
      action: "EXPORT",
      purpose: "Full record export",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({
      exportedAt: new Date().toISOString(),
      format: "hafya.v1.json",
      profile,
      conditions,
      medications,
      labResults,
      vitals,
      allergies,
      immunizations,
      appointments,
      carePlans,
      documents,
    });
  });
}

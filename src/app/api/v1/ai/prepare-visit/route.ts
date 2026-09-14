import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId } from "@/lib/api/patient-scope";
import { featureFlags } from "@/lib/feature-flags";
import { getAIProvider } from "@/lib/ai";

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    if (!featureFlags.ai) throw new ApiException("FORBIDDEN", "AI features are currently disabled.");

    const actor = await requireUser();
    const body = await request.json().catch(() => ({}));
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "CONDITIONS", action: "VIEW", resourceType: "AIVisitPrep" });

    const recentEvents = await db.healthEvent.findMany({
      where: { patientId },
      orderBy: { eventDate: "desc" },
      select: { id: true, type: true, title: true },
      take: 10,
    });

    const response = await getAIProvider().prepareForVisit(
      recentEvents.map((e) => ({ type: e.type, id: e.id, label: e.title }))
    );
    return apiSuccess(response);
  });
}

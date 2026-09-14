import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";
import { featureFlags } from "@/lib/feature-flags";
import { getAIProvider } from "@/lib/ai";

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    if (!featureFlags.ai) throw new ApiException("FORBIDDEN", "AI features are currently disabled.");

    await requireUser();
    const body = await request.json();
    const labResultId = body.labResultId as string | undefined;
    if (!labResultId) throw new ApiException("VALIDATION_ERROR", "labResultId is required.");

    const lab = await db.labResult.findUnique({ where: { id: labResultId } });
    if (!lab || lab.deletedAt) throw new ApiException("NOT_FOUND", "Lab result not found.");

    await authorizePatientAccess(request, {
      patientId: lab.patientId,
      scope: "LAB_RESULTS",
      action: "VIEW",
      resourceType: "AILabExplanation",
      resourceId: lab.id,
    });

    let response;
    try {
      response = await getAIProvider().explainLabResult({
        type: "LabResult",
        id: lab.id,
        label: lab.testName,
        resultText: `${lab.resultValue}${lab.unit ?? ""} (reference: ${lab.referenceRange ?? "not provided"})`,
      });
    } catch {
      throw new ApiException("INTERNAL_ERROR", "This explanation is temporarily unavailable. Please try again shortly.");
    }
    return apiSuccess(response);
  });
}

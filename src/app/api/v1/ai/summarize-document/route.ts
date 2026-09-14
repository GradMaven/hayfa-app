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
    const documentId = body.documentId as string | undefined;
    if (!documentId) throw new ApiException("VALIDATION_ERROR", "documentId is required.");

    const document = await db.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new ApiException("NOT_FOUND", "Document not found.");
    if (document.ocrStatus === "NOT_APPLICABLE" || document.ocrStatus === "PENDING" || document.ocrStatus === "PROCESSING") {
      throw new ApiException("CONFLICT", "This document has no extracted text to summarize yet.");
    }

    await authorizePatientAccess(request, {
      patientId: document.patientId,
      scope: "DOCUMENTS",
      action: "VIEW",
      resourceType: "AIDocumentSummary",
      resourceId: document.id,
    });

    const extracted = document.ocrExtractedData as { rawText?: string } | null;
    let response;
    try {
      response = await getAIProvider().summarizeDocument({
        type: "Document",
        id: document.id,
        label: document.title,
        extractedText: extracted?.rawText ?? "",
      });
    } catch {
      throw new ApiException("INTERNAL_ERROR", "This document summary is temporarily unavailable. Please try again shortly.");
    }
    return apiSuccess(response);
  });
}

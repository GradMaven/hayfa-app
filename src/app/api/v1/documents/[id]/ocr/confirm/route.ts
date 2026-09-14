import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";
import { ocrConfirmSchema } from "@/lib/validation/documents";
import { recordHealthEvent } from "@/lib/health-events";

// The only place OCR output can become a structured clinical record — and
// only with the values the user reviewed here, which may differ from the raw
// extraction if they edited a field first (§18).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const document = await db.document.findUnique({ where: { id } });
    if (!document || document.deletedAt) throw new ApiException("NOT_FOUND", "Document not found.");
    if (document.ocrStatus !== "COMPLETED") {
      throw new ApiException("CONFLICT", "This document has no OCR draft ready to confirm.");
    }

    await authorizePatientAccess(request, { patientId: document.patientId, scope: "DOCUMENTS", action: "UPDATE", resourceType: "Document", resourceId: id });

    const body = await request.json();
    const input = ocrConfirmSchema.parse({ ...body, documentId: id });

    let createdRecordId: string | null = null;

    if (input.createAs === "LAB_RESULT") {
      const testName = input.fields["Test Name"] ?? input.fields.testName;
      const resultValue = input.fields["Result"] ?? input.fields.resultValue;
      if (!testName || !resultValue) {
        throw new ApiException("VALIDATION_ERROR", "Test Name and Result are required to create a lab result.");
      }
      const labResult = await db.labResult.create({
        data: {
          patientId: document.patientId,
          testName,
          resultValue,
          unit: input.fields["Unit"] ?? input.fields.unit,
          referenceRange: input.fields["Reference Range"] ?? input.fields.referenceRange,
          testDate: document.documentDate ?? document.uploadedAt,
          documentId: document.id,
          source: "OCR",
          verificationStatus: "PATIENT_CONFIRMED",
          aiExtractionConfidence: document.ocrConfidence,
        },
      });
      createdRecordId = labResult.id;

      await recordHealthEvent({
        patientId: document.patientId,
        type: "LAB",
        title: `Lab result: ${labResult.testName} ${labResult.resultValue}${labResult.unit ?? ""} (from document)`,
        eventDate: labResult.testDate,
        sourceEntityType: "LabResult",
        sourceEntityId: labResult.id,
      });
    }

    await db.document.update({ where: { id }, data: { ocrStatus: "CONFIRMED" } });

    return apiSuccess({ documentId: id, createdRecordId });
  });
}

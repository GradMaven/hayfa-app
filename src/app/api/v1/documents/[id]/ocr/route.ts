import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";
import { getStorageProvider } from "@/lib/storage";
import { getOcrProvider } from "@/lib/ocr";
import { featureFlags } from "@/lib/feature-flags";

// Runs OCR extraction and stores the DRAFT result on the document. This
// never creates or modifies a structured clinical record — see
// docs/ai-architecture.md "OCR confirm-before-write". A human must call
// /confirm to turn any of this into a LabResult (or reject it entirely).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    if (!featureFlags.ocr) {
      throw new ApiException("FORBIDDEN", "Document intelligence is currently disabled.");
    }
    await requireUser();
    const { id } = await params;
    const document = await db.document.findUnique({ where: { id } });
    if (!document || document.deletedAt) throw new ApiException("NOT_FOUND", "Document not found.");

    await authorizePatientAccess(request, { patientId: document.patientId, scope: "DOCUMENTS", action: "UPDATE", resourceType: "Document", resourceId: id });

    await db.document.update({ where: { id }, data: { ocrStatus: "PROCESSING" } });

    try {
      const url = await getStorageProvider().getSignedDownloadUrl(document.storageKey, 60);
      const fileResponse = await fetch(url);
      const buffer = Buffer.from(await fileResponse.arrayBuffer());

      const result = await getOcrProvider().extract({ buffer, mimeType: document.mimeType });

      const updated = await db.document.update({
        where: { id },
        data: {
          ocrStatus: "COMPLETED",
          ocrExtractedData: result as never,
          ocrConfidence: result.overallConfidence,
        },
      });
      // storageKey is never returned to the client (§45) — same rule as the
      // plain document GET route.
      const { storageKey, ...safe } = updated;
      void storageKey;
      return apiSuccess(safe);
    } catch (err) {
      await db.document.update({ where: { id }, data: { ocrStatus: "FAILED" } });
      throw err;
    }
  });
}

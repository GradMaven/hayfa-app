import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";
import { getStorageProvider } from "@/lib/storage";

// Returns a short-lived signed URL rather than streaming/redirecting so the
// client controls when the (auditable) download actually happens, and the
// URL itself is never a permanent public link (§45).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const document = await db.document.findUnique({ where: { id } });
    if (!document || document.deletedAt) throw new ApiException("NOT_FOUND", "Document not found.");

    await authorizePatientAccess(request, {
      patientId: document.patientId,
      scope: "DOCUMENTS",
      action: "EXPORT",
      resourceType: "Document",
      resourceId: id,
      purpose: "Document download",
    });

    const url = await getStorageProvider().getSignedDownloadUrl(document.storageKey, 300);
    return apiSuccess({ url, expiresInSeconds: 300 });
  });
}

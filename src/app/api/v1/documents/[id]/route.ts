import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess } from "@/lib/api/patient-scope";

async function loadDocument(id: string) {
  const record = await db.document.findUnique({ where: { id } });
  if (!record || record.deletedAt) throw new ApiException("NOT_FOUND", "Document not found.");
  return record;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const document = await loadDocument(id);
    await authorizePatientAccess(request, { patientId: document.patientId, scope: "DOCUMENTS", action: "VIEW", resourceType: "Document", resourceId: id });

    const { storageKey, ...safe } = document;
    void storageKey; // never returned to the client — download goes through the signed-URL endpoint only
    return apiSuccess(safe);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    await requireUser();
    const { id } = await params;
    const document = await loadDocument(id);
    await authorizePatientAccess(request, { patientId: document.patientId, scope: "DOCUMENTS", action: "DELETE", resourceType: "Document", resourceId: id });

    // Soft delete — the object stays in storage (retention policy, §79) but
    // is no longer visible to the app.
    await db.document.update({ where: { id }, data: { deletedAt: new Date() } });
    return apiSuccess({ deleted: true });
  });
}

import type { NextRequest } from "next/server";
import { createHash, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId, sourceForActor, verificationForActor } from "@/lib/api/patient-scope";
import { documentMetadataSchema, ACCEPTED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/validation/documents";
import { getStorageProvider, buildDocumentStorageKey } from "@/lib/storage";
import { recordHealthEvent } from "@/lib/health-events";
import { featureFlags } from "@/lib/feature-flags";
import { getMalwareScanProvider, MalwareScanUnavailableError } from "@/lib/malware-scan";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "DOCUMENTS", action: "VIEW", resourceType: "Document" });

    const documentType = request.nextUrl.searchParams.get("documentType");
    const records = await db.document.findMany({
      where: { patientId, deletedAt: null, ...(documentType ? { documentType: documentType as never } : {}) },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        documentType: true,
        title: true,
        providerName: true,
        documentDate: true,
        uploadedAt: true,
        mimeType: true,
        sizeBytes: true,
        source: true,
        verificationStatus: true,
        sensitivity: true,
        ocrStatus: true,
        malwareScanStatus: true,
        tags: true,
      },
    });
    return apiSuccess(records);
  });
}

// multipart/form-data upload. Files never touch the database — only
// metadata + a storageKey pointing at object storage (§45).
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const form = await request.formData();

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiException("VALIDATION_ERROR", "A file is required.");
    }
    if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type as never)) {
      throw new ApiException("VALIDATION_ERROR", "Unsupported file type. Upload a PDF, JPEG, PNG, or WebP.");
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new ApiException("VALIDATION_ERROR", "File is too large (20MB max).");
    }

    const patientIdRaw = form.get("patientId");
    const patientId = resolvePatientId(actor, typeof patientIdRaw === "string" ? patientIdRaw : null);
    await authorizePatientAccess(request, { patientId, scope: "DOCUMENTS", action: "CREATE", resourceType: "Document" });

    const metadata = documentMetadataSchema.parse({
      documentType: form.get("documentType"),
      title: form.get("title"),
      providerName: form.get("providerName") || undefined,
      documentDate: form.get("documentDate") || undefined,
      tags: form.get("tags") ? JSON.parse(String(form.get("tags"))) : [],
      sensitivity: form.get("sensitivity") || "STANDARD",
    });

    const buffer = Buffer.from(await file.arrayBuffer());

    // §18 pipeline: scan before anything is persisted — an infected file
    // never reaches object storage or gets a Document row. A scanner that
    // can't be reached fails the request closed (never silently "clean").
    let scanOutcome;
    try {
      scanOutcome = await getMalwareScanProvider().scan(buffer);
    } catch (err) {
      if (err instanceof MalwareScanUnavailableError) {
        throw new ApiException("INTERNAL_ERROR", "We couldn't check this file for safety right now. Please try again in a moment.");
      }
      throw err;
    }

    if (scanOutcome.status === "INFECTED") {
      await writeAuditEvent({
        actorUserId: actor.id,
        actorLabel: actor.name,
        action: "DOCUMENT_UPLOAD_REJECTED_MALWARE",
        resourceType: "Document",
        patientId,
        metadata: { fileName: file.name, mimeType: file.type, sizeBytes: file.size, threatName: scanOutcome.threatName },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
      throw new ApiException("VALIDATION_ERROR", "This file could not be uploaded because it appears to contain malicious content.");
    }

    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const documentId = randomUUID();
    const storageKey = buildDocumentStorageKey(patientId, documentId, file.name);

    await getStorageProvider().put({ key: storageKey, body: buffer, mimeType: file.type });

    const document = await db.document.create({
      data: {
        id: documentId,
        patientId,
        ...metadata,
        uploadedByUserId: actor.id,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        fileHash,
        source: sourceForActor(actor),
        verificationStatus: verificationForActor(actor),
        ocrStatus: featureFlags.ocr ? "PENDING" : "NOT_APPLICABLE",
        malwareScanStatus: scanOutcome.status === "CLEAN" ? "CLEAN" : "SKIPPED",
        malwareScannedAt: scanOutcome.status === "CLEAN" ? new Date() : null,
      },
    });

    await recordHealthEvent({
      patientId,
      type: "DOCUMENT",
      title: `Document uploaded: ${document.title}`,
      eventDate: document.documentDate ?? document.uploadedAt,
      sourceEntityType: "Document",
      sourceEntityId: document.id,
    });

    return apiSuccess(document, undefined, 201);
  });
}

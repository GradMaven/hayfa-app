import { z } from "zod";

export const DOCUMENT_TYPES = [
  "PRESCRIPTION",
  "LAB_REPORT",
  "DISCHARGE_SUMMARY",
  "IMAGING_REPORT",
  "INVOICE",
  "REFERRAL",
  "VACCINATION_CARD",
  "MEDICAL_CERTIFICATE",
  "INSURANCE_DOCUMENT",
  "OTHER",
] as const;

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const documentMetadataSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().min(1).max(200),
  providerName: z.string().trim().max(200).optional(),
  documentDate: z.coerce.date().optional(),
  tags: z.array(z.string().trim().max(50)).max(20).default([]),
  sensitivity: z.enum(["STANDARD", "SENSITIVE"]).default("STANDARD"),
});
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;

// The document's OCR draft is never auto-written to the record (§18). This
// schema is what the *confirm* step accepts: the user-reviewed values plus
// which structured record type to create from them.
export const ocrConfirmSchema = z.object({
  // Document.id is generated with crypto.randomUUID() in
  // src/app/api/v1/documents/route.ts (needed up front to build the storage
  // key before the row exists) — a real UUID, not a cuid, even though
  // Document's Prisma default is @default(cuid()) like every other model.
  // This was `.cuid()` until live verification of the OCR-confirm flow
  // caught it rejecting every real document's ID with VALIDATION_ERROR.
  documentId: z.string().uuid(),
  createAs: z.enum(["LAB_RESULT", "NONE"]),
  fields: z.record(z.string(), z.string()),
});
export type OcrConfirmInput = z.infer<typeof ocrConfirmSchema>;

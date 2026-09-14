import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser, type CurrentUser } from "@/lib/auth/current-user";
import { resolvePatientId } from "@/lib/api/patient-scope";
import { correctionRequestSchema, type CorrectionRequestInput } from "@/lib/validation/corrections";
import { medicationSchema, conditionSchema, labResultSchema } from "@/lib/validation/clinical";
import { pickProvidedFields } from "@/lib/validation/partial-update";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// §56's correction workflow: only the patient who owns a record can dispute
// it — like Consent creation, this is intentionally NOT routed through
// canAccess() (which governs *others* reading/writing a patient's data);
// correcting your own record is an owner-only action.
function assertOwner(actor: CurrentUser, patientId: string): void {
  if (actor.patientProfileId !== patientId) {
    throw new ApiException("FORBIDDEN", "Only the patient can request a correction to their own record.");
  }
}

// Snapshot only the fields actually being changed, read from the record as
// it stood before the update — this becomes CorrectionRequest.previousValues,
// the permanent record of what the original source asserted.
function snapshot(record: Record<string, unknown>, fields: Record<string, unknown>): Record<string, unknown> {
  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) previous[key] = record[key] ?? null;
  return previous;
}

async function applyCorrection(actor: CurrentUser, input: CorrectionRequestInput) {
  switch (input.resourceType) {
    case "MEDICATION": {
      const existing = await db.medication.findUnique({ where: { id: input.resourceId } });
      if (!existing || existing.deletedAt) throw new ApiException("NOT_FOUND", "Medication not found.");
      assertOwner(actor, existing.patientId);
      const fields = pickProvidedFields(medicationSchema.partial().parse(input.correctedFields), input.correctedFields);
      const previousValues = snapshot(existing as unknown as Record<string, unknown>, fields);
      const record = await db.medication.update({
        where: { id: input.resourceId },
        data: { ...fields, verificationStatus: "PATIENT_CORRECTED" },
      });
      const correction = await db.correctionRequest.create({
        data: {
          patientId: existing.patientId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          requestedByUserId: actor.id,
          reason: input.reason,
          previousValues: previousValues as never,
          correctedValues: fields as never,
          status: "APPLIED",
        },
      });
      return { patientId: existing.patientId, label: "Medication", record, correction, correctedValues: fields };
    }
    case "CONDITION": {
      const existing = await db.condition.findUnique({ where: { id: input.resourceId } });
      if (!existing || existing.deletedAt) throw new ApiException("NOT_FOUND", "Condition not found.");
      assertOwner(actor, existing.patientId);
      const fields = pickProvidedFields(conditionSchema.partial().parse(input.correctedFields), input.correctedFields);
      const previousValues = snapshot(existing as unknown as Record<string, unknown>, fields);
      const record = await db.condition.update({
        where: { id: input.resourceId },
        data: { ...fields, verificationStatus: "PATIENT_CORRECTED" },
      });
      const correction = await db.correctionRequest.create({
        data: {
          patientId: existing.patientId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          requestedByUserId: actor.id,
          reason: input.reason,
          previousValues: previousValues as never,
          correctedValues: fields as never,
          status: "APPLIED",
        },
      });
      return { patientId: existing.patientId, label: "Condition", record, correction, correctedValues: fields };
    }
    case "LAB_RESULT": {
      const existing = await db.labResult.findUnique({ where: { id: input.resourceId } });
      if (!existing || existing.deletedAt) throw new ApiException("NOT_FOUND", "Lab result not found.");
      assertOwner(actor, existing.patientId);
      const fields = pickProvidedFields(labResultSchema.partial().parse(input.correctedFields), input.correctedFields);
      const previousValues = snapshot(existing as unknown as Record<string, unknown>, fields);
      const record = await db.labResult.update({
        where: { id: input.resourceId },
        data: { ...fields, verificationStatus: "PATIENT_CORRECTED" },
      });
      const correction = await db.correctionRequest.create({
        data: {
          patientId: existing.patientId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          requestedByUserId: actor.id,
          reason: input.reason,
          previousValues: previousValues as never,
          correctedValues: fields as never,
          status: "APPLIED",
        },
      });
      return { patientId: existing.patientId, label: "LabResult", record, correction, correctedValues: fields };
    }
  }
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const input = correctionRequestSchema.parse(body);

    const result = await applyCorrection(actor, input);

    await writeAuditEvent({
      actorUserId: actor.id,
      actorLabel: actor.name,
      action: "RECORD_CORRECTION_SUBMITTED",
      resourceType: result.label,
      resourceId: input.resourceId,
      patientId: result.patientId,
      metadata: { reason: input.reason, fields: Object.keys(result.correctedValues) },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ record: result.record, correction: result.correction }, undefined, 201);
  });
}

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    if (patientId !== actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Only the patient can view corrections for their own record.");
    }

    const resourceType = request.nextUrl.searchParams.get("resourceType");
    const resourceId = request.nextUrl.searchParams.get("resourceId");

    const corrections = await db.correctionRequest.findMany({
      where: {
        patientId,
        ...(resourceType ? { resourceType } : {}),
        ...(resourceId ? { resourceId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(corrections);
  });
}

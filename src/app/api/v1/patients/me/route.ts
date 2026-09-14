import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { patientProfileSchema, patientProfileUpdateSchema } from "@/lib/validation/patient-profile";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

export async function GET() {
  return withApiErrors(async () => {
    const user = await requireUser();
    if (!user.patientProfileId) return apiSuccess(null);
    const profile = await db.patientProfile.findUnique({ where: { id: user.patientProfileId } });
    return apiSuccess(profile);
  });
}

// Onboarding: creates the health profile (§12/§99 golden path step 2).
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireUser();
    if (user.patientProfileId) {
      throw new ApiException("CONFLICT", "A health profile already exists for this account.");
    }
    const body = await request.json();
    const input = patientProfileSchema.parse(body);

    const profile = await db.patientProfile.create({
      data: { userId: user.id, ...input },
    });

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "PROFILE_CREATED",
      resourceType: "PatientProfile",
      resourceId: profile.id,
      patientId: profile.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess(profile, undefined, 201);
  });
}

export async function PATCH(request: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireUser();
    if (!user.patientProfileId) {
      throw new ApiException("NOT_FOUND", "No health profile exists yet.");
    }
    const body = await request.json();
    const input = patientProfileUpdateSchema.parse(body);

    const profile = await db.patientProfile.update({
      where: { id: user.patientProfileId },
      data: input,
    });

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "PROFILE_UPDATED",
      resourceType: "PatientProfile",
      resourceId: profile.id,
      patientId: profile.id,
      metadata: { fields: Object.keys(input) },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess(profile);
  });
}

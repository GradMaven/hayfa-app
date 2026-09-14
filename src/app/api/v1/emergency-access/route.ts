import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";
import { emergencyAccessRequestSchema } from "@/lib/validation/emergency";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

const EMERGENCY_ACCESS_TTL_MS = 60 * 60 * 1000; // 1 hour

// Emergency access is patient-ABSENT, policy-authorized (a verified provider
// + a stated reason), never patient-granted — deliberately not routed
// through Consent/canAccess (see docs/database-architecture.md "Why
// EmergencyAccess is its own model"). Every request here is logged
// regardless of outcome, and the returned dataset is a fixed emergency
// summary — never the full record (§29).
export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireRole("PROVIDER");
    if (!actor.providerVerified) {
      throw new ApiException("FORBIDDEN", "Only verified healthcare providers can request emergency access.");
    }

    const body = await request.json();
    const input = emergencyAccessRequestSchema.parse(body);
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    const patientUser = await db.user.findUnique({
      where: { email: input.patientEmail },
      include: { patientProfile: true },
    });

    if (!patientUser?.patientProfile || !patientUser.patientProfile.emergencyAccessEnabled) {
      await writeAuditEvent({
        actorUserId: actor.id,
        actorLabel: actor.name,
        action: "EMERGENCY_ACCESS_DENIED",
        resourceType: "EmergencyAccess",
        metadata: { patientEmail: input.patientEmail, reason: input.reason },
        ipAddress,
        userAgent,
      });
      throw new ApiException(
        "FORBIDDEN",
        "Emergency access is not available for this patient (not found, or emergency access is not enabled on their profile)."
      );
    }

    const patient = patientUser.patientProfile;

    const grant = await db.emergencyAccess.create({
      data: {
        patientId: patient.id,
        requestedByUserId: actor.id,
        reason: input.reason,
        verificationMethod: input.verificationMethod,
        expiresAt: new Date(Date.now() + EMERGENCY_ACCESS_TTL_MS),
        status: "ACTIVE",
      },
    });

    const [allergies, medications, conditions] = await Promise.all([
      db.allergy.findMany({ where: { patientId: patient.id, deletedAt: null } }),
      db.medication.findMany({ where: { patientId: patient.id, deletedAt: null, status: "ACTIVE" } }),
      db.condition.findMany({ where: { patientId: patient.id, deletedAt: null, status: { in: ["ACTIVE", "MANAGED"] } } }),
    ]);

    await writeAuditEvent({
      actorUserId: actor.id,
      actorLabel: actor.name,
      action: "EMERGENCY_ACCESS_GRANTED",
      resourceType: "EmergencyAccess",
      resourceId: grant.id,
      patientId: patient.id,
      metadata: { reason: input.reason, expiresAt: grant.expiresAt },
      ipAddress,
      userAgent,
    });

    return apiSuccess(
      {
        grantId: grant.id,
        expiresAt: grant.expiresAt,
        patient: {
          fullName: patient.fullName,
          dateOfBirth: patient.dateOfBirth,
          bloodType: patient.bloodType,
          emergencyContactName: patient.emergencyContactName,
          emergencyContactPhone: patient.emergencyContactPhone,
        },
        allergies,
        activeMedications: medications,
        activeConditions: conditions,
      },
      undefined,
      201
    );
  });
}

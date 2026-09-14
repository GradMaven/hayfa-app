import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

const schema = z.object({ enabled: z.boolean() });

// Kept as its own small endpoint rather than folded into the general profile
// PATCH — this toggle changes the account's security posture (§29/§94), so
// it gets its own explicit audit action rather than blending into
// "PROFILE_UPDATED" metadata.
export async function PATCH(request: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireUser();
    if (!user.patientProfileId) throw new ApiException("NOT_FOUND", "No health profile exists yet.");

    const { enabled } = schema.parse(await request.json());

    const profile = await db.patientProfile.update({
      where: { id: user.patientProfileId },
      data: { emergencyAccessEnabled: enabled },
    });

    await writeAuditEvent({
      actorUserId: user.id,
      actorLabel: user.name,
      action: enabled ? "EMERGENCY_ACCESS_ENABLED" : "EMERGENCY_ACCESS_DISABLED",
      resourceType: "PatientProfile",
      resourceId: profile.id,
      patientId: profile.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ emergencyAccessEnabled: profile.emergencyAccessEnabled });
  });
}

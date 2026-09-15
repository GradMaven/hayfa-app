import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { updatePhoneSchema } from "@/lib/validation/account";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// Deliberately narrow account-settings route: only the phone number, needed
// so SMS notifications (§39-40) have somewhere to actually send to. Name,
// email, and password each have their own dedicated, more
// security-sensitive flows and are not handled here.
export async function PATCH(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const { phone } = updatePhoneSchema.parse(body);

    if (phone) {
      const existing = await db.user.findFirst({ where: { phone, NOT: { id: actor.id } } });
      if (existing) {
        throw new ApiException("CONFLICT", "That phone number is already associated with another account.");
      }
    }

    const updated = await db.user.update({
      where: { id: actor.id },
      data: { phone, phoneVerifiedAt: null },
    });

    await writeAuditEvent({
      actorUserId: actor.id,
      actorLabel: actor.name,
      action: phone ? "ACCOUNT_PHONE_UPDATED" : "ACCOUNT_PHONE_REMOVED",
      resourceType: "User",
      resourceId: actor.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess({ phone: updated.phone });
  });
}

import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";
import { updateUserStatusSchema } from "@/lib/validation/admin-user";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { notify } from "@/lib/notifications";

// SUPER_ADMIN-only. User.status is already enforced everywhere it matters —
// signin rejects a non-ACTIVE account (src/app/api/v1/auth/signin/route.ts)
// and validateSessionToken invalidates every existing session for one on
// its very next request (src/lib/auth/session.ts) — this route only needs
// to flip the flag and, for a defense-in-depth belt-and-braces measure,
// proactively revoke their current sessions rather than waiting for that
// next-request check to do it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const admin = await requireRole("SUPER_ADMIN");
    const { id } = await params;

    if (id === admin.id) {
      throw new ApiException("VALIDATION_ERROR", "You can't change your own account status.");
    }

    const body = await request.json();
    const { status, reason } = updateUserStatusSchema.parse(body);

    const user = await db.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new ApiException("NOT_FOUND", "User not found.");

    const updated = await db.user.update({ where: { id }, data: { status } });

    if (status !== "ACTIVE") {
      await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    await writeAuditEvent({
      actorUserId: admin.id,
      actorLabel: admin.name,
      action: "USER_STATUS_CHANGED",
      resourceType: "User",
      resourceId: id,
      metadata: { previousStatus: user.status, newStatus: status, reason: reason ?? null },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (status !== "ACTIVE") {
      await notify({
        userId: id,
        type: "SECURITY",
        title: status === "SUSPENDED" ? "Your account has been suspended" : "Your account has been deactivated",
        body: reason || "Contact support if you believe this was a mistake.",
      });
    }

    return apiSuccess({ id: updated.id, status: updated.status });
  });
}

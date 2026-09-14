import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { resolvePatientId } from "@/lib/api/patient-scope";

// The "who accessed your records" view in the Privacy Center (§30). Only the
// patient can see their own access history — this reads DataAccessLog
// directly rather than going through canAccess(), since viewing your own
// access history isn't itself a "data access" event worth logging again.
export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    if (patientId !== actor.patientProfileId) {
      throw new ApiException("FORBIDDEN", "Only the patient can view their own access history.");
    }

    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 100);

    const logs = await db.dataAccessLog.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > limit;
    const page = hasMore ? logs.slice(0, limit) : logs;
    return apiSuccess(page, { nextCursor: hasMore ? page[page.length - 1].id : null });
  });
}

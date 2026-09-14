import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId } from "@/lib/api/patient-scope";
import { featureFlags } from "@/lib/feature-flags";
import { getAIProvider } from "@/lib/ai";

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    if (!featureFlags.ai) throw new ApiException("FORBIDDEN", "AI features are currently disabled.");

    const actor = await requireUser();
    const body = await request.json().catch(() => ({}));
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "CONDITIONS", action: "VIEW", resourceType: "AIHealthSummary" });

    const from = body.from ? new Date(body.from) : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const to = body.to ? new Date(body.to) : new Date();

    // Data minimization (§50): only id/type/title/date are pulled — never
    // full clinical detail — for a feature that only needs to describe what
    // happened, not why.
    const events = await db.healthEvent.findMany({
      where: { patientId, eventDate: { gte: from, lte: to } },
      orderBy: { eventDate: "desc" },
      select: { id: true, type: true, title: true },
      take: 50,
    });

    const rangeLabel = `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`;

    // §65: fail safely — a vendor outage or rate limit never surfaces a
    // stack trace or raw error to the client, just a plain retry-later message.
    let response;
    try {
      response = await getAIProvider().summarizeTimeline(
        events.map((e) => ({ type: e.type, id: e.id, label: e.title })),
        rangeLabel
      );
    } catch {
      throw new ApiException("INTERNAL_ERROR", "The health summary is temporarily unavailable. Please try again shortly.");
    }
    return apiSuccess(response);
  });
}

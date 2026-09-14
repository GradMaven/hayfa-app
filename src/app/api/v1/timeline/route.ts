import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId } from "@/lib/api/patient-scope";
import type { HealthEventType } from "@prisma/client";

// Every timeline "type" filter maps to the scope that must be checked before
// that slice of history is returned — a caregiver granted only MEDICATIONS
// should see medication events on the timeline and nothing else, not the
// whole thing minus a client-side filter.
const TYPE_TO_SCOPE: Record<HealthEventType, string> = {
  ENCOUNTER: "CONDITIONS",
  DIAGNOSIS: "CONDITIONS",
  MEDICATION: "MEDICATIONS",
  LAB: "LAB_RESULTS",
  VITAL: "VITALS",
  IMMUNIZATION: "IMMUNIZATIONS",
  PROCEDURE: "CONDITIONS",
  DOCUMENT: "DOCUMENTS",
  APPOINTMENT: "APPOINTMENTS",
  CARE_PLAN: "CARE_PLANS",
};

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const params = request.nextUrl.searchParams;
    const patientId = resolvePatientId(actor, params.get("patientId"));

    const typeParam = params.get("type") as HealthEventType | null;
    const from = params.get("from");
    const to = params.get("to");
    const search = params.get("search");
    const cursor = params.get("cursor");
    const limit = Math.min(Number(params.get("limit") ?? 30), 100);

    // Owner/caregiver/provider are all checked the same way canAccess()
    // always checks them — but for an unfiltered timeline we need to know
    // *which* scopes this actor holds so we only return matching event types.
    let allowedScopes: string[] | "ALL";
    if (actor.patientProfileId === patientId) {
      allowedScopes = "ALL";
    } else {
      const caregiverLink = await db.caregiverLink.findFirst({
        where: { patientId, caregiverUserId: actor.id, status: "ACTIVE" },
        select: { permissions: true },
      });
      if (caregiverLink) {
        allowedScopes = caregiverLink.permissions;
      } else {
        const consent = await db.consent.findFirst({
          where: {
            patientId,
            recipientUserId: actor.id,
            status: "ACTIVE",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { dataScopes: true },
        });
        allowedScopes = consent?.dataScopes ?? [];
      }
    }

    if (allowedScopes !== "ALL" && allowedScopes.length === 0) {
      // authorizePatientAccess will produce the standard FORBIDDEN + log the
      // denial consistently rather than duplicating that here.
      await authorizePatientAccess(request, {
        patientId,
        scope: "CONDITIONS",
        action: "VIEW",
        resourceType: "HealthEvent",
      });
    }

    const permittedTypes = (Object.keys(TYPE_TO_SCOPE) as HealthEventType[]).filter(
      (t) => allowedScopes === "ALL" || allowedScopes.includes(TYPE_TO_SCOPE[t])
    );
    const types = typeParam ? permittedTypes.filter((t) => t === typeParam) : permittedTypes;

    const events = await db.healthEvent.findMany({
      where: {
        patientId,
        type: { in: types },
        ...(from || to
          ? { eventDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { eventDate: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;

    return apiSuccess(page, { nextCursor: hasMore ? page[page.length - 1].id : null });
  });
}

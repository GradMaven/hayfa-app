import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { expireStaleConsents } from "@/lib/consent";

// Lists who has granted this provider/caregiver access — the entry point
// into the provider portal's per-patient record view
// (src/app/portal/patients/[patientId]/page.tsx), which re-derives the
// actual authorization itself via canAccess() rather than trusting this
// list; this endpoint is a convenience index, not an authorization source.
export async function GET() {
  return withApiErrors(async () => {
    const user = await requireUser();

    if (user.role === "PROVIDER") {
      // Lazily expire anything that's lapsed, same as the patient-facing
      // sharing list, so a provider never sees a card for access they no
      // longer actually have — the DB update is cheap (only ever touches
      // this provider's own already-lapsed rows) and canAccess() would
      // reject the read anyway if we skipped this.
      const patientIds = await db.consent.findMany({
        where: { recipientUserId: user.id, status: "ACTIVE" },
        select: { patientId: true },
        distinct: ["patientId"],
      });
      await Promise.all(patientIds.map((p) => expireStaleConsents(p.patientId)));

      const consents = await db.consent.findMany({
        where: { recipientUserId: user.id, status: "ACTIVE" },
        include: { patient: { select: { fullName: true } } },
        orderBy: { grantedAt: "desc" },
      });
      return apiSuccess({
        role: "PROVIDER",
        patients: consents.map((c) => ({
          consentId: c.id,
          patientId: c.patientId,
          patientName: c.patient.fullName,
          purpose: c.purpose,
          dataScopes: c.dataScopes,
          expiresAt: c.expiresAt,
        })),
      });
    }

    if (user.role === "CAREGIVER") {
      const links = await db.caregiverLink.findMany({
        where: { caregiverUserId: user.id, status: "ACTIVE" },
        include: { patient: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      });
      return apiSuccess({
        role: "CAREGIVER",
        patients: links.map((l) => ({
          linkId: l.id,
          patientName: l.patient.fullName,
          relationship: l.relationship,
          permissions: l.permissions,
        })),
      });
    }

    return apiSuccess({ role: user.role, patients: [] });
  });
}

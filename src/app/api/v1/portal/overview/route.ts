import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";

// A deliberately small endpoint: the full provider/caregiver portal (§62,
// caregiver record browsing) isn't built in this phase (see
// docs/discovery-report.md scope cut), but "who has granted you access"
// is real, already-modeled data — showing it honestly beats a dead end.
export async function GET() {
  return withApiErrors(async () => {
    const user = await requireUser();

    if (user.role === "PROVIDER") {
      const consents = await db.consent.findMany({
        where: { recipientUserId: user.id, status: "ACTIVE" },
        include: { patient: { select: { fullName: true } } },
        orderBy: { grantedAt: "desc" },
      });
      return apiSuccess({
        role: "PROVIDER",
        patients: consents.map((c) => ({
          consentId: c.id,
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

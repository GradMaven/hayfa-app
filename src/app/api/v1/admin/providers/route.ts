import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";

const STATUS_VALUES = ["PENDING", "VERIFIED", "REJECTED", "UNVERIFIED"] as const;

// SUPER_ADMIN-only. Deliberately the only admin surface built this pass —
// see docs/admin-architecture.md for why this doesn't extend to org/billing/
// analytics/user-suspension yet, and for why this never touches patient
// clinical data (requireRole() alone is never sufficient for that — see
// docs/security-architecture.md "Administrative privilege ≠ clinical-data
// privilege" — but this route only ever reads HealthcareProvider/User
// account fields, nothing patient-scoped).
export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const statusParam = request.nextUrl.searchParams.get("status");
    const status = STATUS_VALUES.includes(statusParam as never) ? (statusParam as (typeof STATUS_VALUES)[number]) : "PENDING";

    const providers = await db.healthcareProvider.findMany({
      where: { verificationStatus: status },
      include: { user: { select: { email: true, phone: true, createdAt: true } }, organization: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess(
      providers.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        specialty: p.specialty,
        licenseNumber: p.licenseNumber,
        verificationStatus: p.verificationStatus,
        organizationName: p.organization?.name ?? null,
        email: p.user.email,
        phone: p.user.phone,
        registeredAt: p.user.createdAt,
      }))
    );
  });
}

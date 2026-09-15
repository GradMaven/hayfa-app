import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";

// Deliberately public (no requireUser()) — a registering provider needs to
// pick their workplace before they have an account (see
// POST /api/v1/auth/provider-signup and (auth)/provider-signup/page.tsx).
// Only verified organizations and only non-sensitive fields (name, type,
// county) are exposed; an unverified organization isn't shown here until an
// admin approves it (see docs/admin-architecture.md).
export async function GET() {
  return withApiErrors(async () => {
    const organizations = await db.organization.findMany({
      where: { verified: true, deletedAt: null },
      select: { id: true, name: true, type: true, county: true },
      orderBy: { name: "asc" },
    });
    return apiSuccess(organizations);
  });
}

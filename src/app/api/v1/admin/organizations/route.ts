import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";
import { organizationSchema } from "@/lib/validation/organization";
import { writeAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request-context";

// SUPER_ADMIN-only. Unlike GET /api/v1/organizations (public, verified-only,
// name/type/county only), this lists every organization including
// unverified ones and is the admin-facing management surface — see
// docs/admin-architecture.md.
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const organizations = await db.organization.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { providers: true } } },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(
      organizations.map((o) => ({
        id: o.id,
        name: o.name,
        type: o.type,
        county: o.county,
        verified: o.verified,
        providerCount: o._count.providers,
        createdAt: o.createdAt,
      }))
    );
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const admin = await requireRole("SUPER_ADMIN");
    const body = await request.json();
    const input = organizationSchema.parse(body);

    const org = await db.organization.create({ data: input });

    await writeAuditEvent({
      actorUserId: admin.id,
      actorLabel: admin.name,
      action: "ORGANIZATION_CREATED",
      resourceType: "Organization",
      resourceId: org.id,
      metadata: { name: org.name, type: org.type },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return apiSuccess(org, undefined, 201);
  });
}

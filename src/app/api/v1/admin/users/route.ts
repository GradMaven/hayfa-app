import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireRole } from "@/lib/auth/current-user";
import type { UserRole, UserStatus } from "@prisma/client";

const ROLE_VALUES: UserRole[] = [
  "PATIENT",
  "CAREGIVER",
  "PROVIDER",
  "PROVIDER_ADMIN",
  "ORG_ADMIN",
  "INTEGRATION_ADMIN",
  "PLATFORM_SUPPORT",
  "SUPER_ADMIN",
];
const STATUS_VALUES: UserStatus[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

// SUPER_ADMIN-only. Account administration only — never returns
// passwordHash, and never joins in anything patient-scoped (clinical
// records, documents, consents). See docs/admin-architecture.md
// "Administrative privilege ≠ clinical-data privilege".
export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const roleParam = request.nextUrl.searchParams.get("role");
    const statusParam = request.nextUrl.searchParams.get("status");
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const role = ROLE_VALUES.includes(roleParam as UserRole) ? (roleParam as UserRole) : undefined;
    const status = STATUS_VALUES.includes(statusParam as UserStatus) ? (statusParam as UserStatus) : undefined;

    const users = await db.user.findMany({
      where: {
        deletedAt: null,
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        mfaEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return apiSuccess(users);
  });
}

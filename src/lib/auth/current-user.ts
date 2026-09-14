import { cache } from "react";
import { db } from "@/lib/db";
import { getSessionTokenFromCookies } from "./cookies";
import { validateSessionToken } from "./session";
import { ApiException } from "@/lib/api-response";
import type { UserRole } from "@prisma/client";

// cache() de-dupes repeated calls within a single request/render pass so
// route handlers and server components can each call getCurrentUser() freely
// without hitting the DB twice for the same request.
export const getCurrentUser = cache(async () => {
  const rawToken = await getSessionTokenFromCookies();
  if (!rawToken) return null;

  const result = await validateSessionToken(rawToken);
  if (!result) return null;

  const patientProfile = await db.patientProfile.findUnique({
    where: { userId: result.user.id },
    select: { id: true },
  });
  const providerProfile = await db.healthcareProvider.findUnique({
    where: { userId: result.user.id },
    select: { id: true, organizationId: true, verificationStatus: true },
  });

  return {
    id: result.user.id,
    email: result.user.email,
    phone: result.user.phone,
    name: result.user.name,
    role: result.user.role,
    sessionId: result.session.id,
    patientProfileId: patientProfile?.id ?? null,
    providerProfileId: providerProfile?.id ?? null,
    providerOrganizationId: providerProfile?.organizationId ?? null,
    providerVerified: providerProfile?.verificationStatus === "VERIFIED",
    emailVerified: result.user.emailVerifiedAt !== null,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiException("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

// Coarse gate only — "can this role ever call this endpoint". Object-level
// authorization (does THIS actor have rights to THIS patient's data) still
// has to happen separately via lib/consent — see docs/security-architecture.md.
export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ApiException("FORBIDDEN", "You do not have permission to access this resource.");
  }
  return user;
}

export async function requirePatientProfile(): Promise<CurrentUser & { patientProfileId: string }> {
  const user = await requireUser();
  if (!user.patientProfileId) {
    throw new ApiException("FORBIDDEN", "Complete your health profile first.");
  }
  return user as CurrentUser & { patientProfileId: string };
}

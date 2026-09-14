import type { NextRequest } from "next/server";
import { requireUser, type CurrentUser } from "@/lib/auth/current-user";
import { canAccess, type DataScope } from "@/lib/consent";
import { getClientIp, getUserAgent } from "@/lib/request-context";
import { ApiException } from "@/lib/api-response";
import type { DataAccessAction } from "@prisma/client";

// Shared boilerplate for every /api/v1/* route that reads or writes a single
// patient's clinical data: authenticate, resolve which patient is being
// acted on, and run the request through the consent engine — which itself
// writes the access-log entry (§89/§90). Route handlers stay focused on
// their own validation + Prisma call; this is the part that must never be
// gotten wrong differently in seven different files.

export function resolvePatientId(actor: CurrentUser, provided?: string | null): string {
  if (provided) return provided;
  if (actor.patientProfileId) return actor.patientProfileId;
  throw new ApiException(
    "VALIDATION_ERROR",
    "patientId is required (no patient profile is associated with your account)."
  );
}

export async function authorizePatientAccess(
  request: NextRequest,
  params: {
    patientId: string;
    scope: DataScope;
    action: DataAccessAction;
    resourceType: string;
    resourceId?: string;
    purpose?: string;
  }
): Promise<CurrentUser> {
  const actor = await requireUser();
  const decision = await canAccess({
    actor,
    patientId: params.patientId,
    scope: params.scope,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    purpose: params.purpose,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });
  if (!decision.allowed) {
    throw new ApiException("FORBIDDEN", "You do not have permission to access this patient's records.");
  }
  return actor;
}

// Clinical writes are attributed by who made them, not just what was
// written — feeds §31 provenance.
export function sourceForActor(actor: CurrentUser): "PATIENT_ENTERED" | "PROVIDER_ENTERED" {
  return actor.providerProfileId ? "PROVIDER_ENTERED" : "PATIENT_ENTERED";
}

export function verificationForActor(actor: CurrentUser): "UNVERIFIED" | "PROVIDER_VERIFIED" {
  return actor.providerProfileId && actor.providerVerified ? "PROVIDER_VERIFIED" : "UNVERIFIED";
}

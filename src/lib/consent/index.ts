import { db } from "@/lib/db";
import { writeDataAccessLog } from "@/lib/audit";
import type { DataAccessAction } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth/current-user";

// The data-scope vocabulary used by both Consent.dataScopes and
// CaregiverLink.permissions. Kept as a plain string union (not a DB enum) so
// adding a scope doesn't require a migration — see prisma/schema.prisma.
export const DATA_SCOPES = [
  "MEDICATIONS",
  "ALLERGIES",
  "APPOINTMENTS",
  "LAB_RESULTS",
  "CONDITIONS",
  "DOCUMENTS",
  "VITALS",
  "IMMUNIZATIONS",
  "CARE_PLANS",
  "MENTAL_HEALTH",
  "INSURANCE",
] as const;
export type DataScope = (typeof DATA_SCOPES)[number];

export interface AccessRequest {
  actor: CurrentUser;
  patientId: string;
  scope: DataScope;
  action: DataAccessAction;
  resourceType: string;
  resourceId?: string;
  purpose?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type AccessDecision =
  | { allowed: true; reason: "OWNER" | "CAREGIVER" | "CONSENT"; consentId?: string }
  | { allowed: false; reason: "NO_RELATIONSHIP" | "SCOPE_NOT_GRANTED" | "PATIENT_NOT_FOUND" };

// The single place every patient-scoped read/write must pass through.
// Deliberately does NOT trust the caller's own role check — it re-derives the
// relationship (ownership / caregiver link / consent grant) from the database
// every time. See docs/security-architecture.md "defense in depth".
export async function canAccess(req: AccessRequest): Promise<AccessDecision> {
  const decision = await evaluate(req);

  await writeDataAccessLog({
    patientId: req.patientId,
    actorUserId: req.actor.id,
    actorLabel: req.actor.name,
    consentId: decision.allowed && decision.reason === "CONSENT" ? decision.consentId ?? null : null,
    resourceType: req.resourceType,
    resourceId: req.resourceId,
    action: req.action,
    purpose: req.purpose,
    result: decision.allowed ? "ALLOWED" : "DENIED",
    ipAddress: req.ipAddress,
    userAgent: req.userAgent,
  });

  return decision;
}

async function evaluate(req: AccessRequest): Promise<AccessDecision> {
  const { actor, patientId, scope } = req;

  // Owner: a patient always has full access to their own record.
  if (actor.patientProfileId && actor.patientProfileId === patientId) {
    return { allowed: true, reason: "OWNER" };
  }

  // Caregiver: only the scopes the patient explicitly granted.
  const caregiverLink = await db.caregiverLink.findFirst({
    where: { patientId, caregiverUserId: actor.id, status: "ACTIVE" },
    select: { permissions: true },
  });
  if (caregiverLink) {
    if (caregiverLink.permissions.includes(scope)) {
      return { allowed: true, reason: "CAREGIVER" };
    }
    return { allowed: false, reason: "SCOPE_NOT_GRANTED" };
  }

  // Provider (or org staff acting as a granted recipient): an active,
  // unexpired consent naming this scope.
  if (actor.providerProfileId) {
    const consent = await db.consent.findFirst({
      where: {
        patientId,
        recipientUserId: actor.id,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, dataScopes: true },
    });
    if (consent) {
      if (consent.dataScopes.includes(scope)) {
        return { allowed: true, reason: "CONSENT", consentId: consent.id };
      }
      return { allowed: false, reason: "SCOPE_NOT_GRANTED" };
    }
  }

  return { allowed: false, reason: "NO_RELATIONSHIP" };
}

// Lazily flips ACTIVE consents whose expiresAt has passed into EXPIRED.
// Called opportunistically from the sharing list endpoint rather than as a
// cron job, since MVP scope has no background worker yet.
export async function expireStaleConsents(patientId: string): Promise<void> {
  await db.consent.updateMany({
    where: { patientId, status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

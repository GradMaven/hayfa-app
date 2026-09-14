import { db } from "@/lib/db";
import type { DataAccessAction, AccessResult } from "@prisma/client";

// Append-only by convention: this module only ever calls .create(). Nothing
// in the codebase should import PrismaClient's audit/access-log delegates
// directly and call update/delete on them — see docs/database-architecture.md.

export interface AuditWrite {
  actorUserId?: string | null;
  actorLabel?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditEvent(entry: AuditWrite): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorUserId: entry.actorUserId ?? null,
      actorLabel: entry.actorLabel ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      patientId: entry.patientId ?? null,
      metadata: entry.metadata as never,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

export interface DataAccessWrite {
  patientId: string;
  actorUserId?: string | null;
  actorLabel: string;
  consentId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  action: DataAccessAction;
  purpose?: string | null;
  result?: AccessResult;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// This is the log a patient sees in their Privacy Center under "who accessed
// your records" (§30) — distinct from AuditEvent, which is the platform-wide
// security/ops trail. Every read/write of patient-scoped clinical data must
// go through lib/consent's canAccess(), which calls this for both ALLOW and
// DENY outcomes so blocked attempts are visible too.
export async function writeDataAccessLog(entry: DataAccessWrite): Promise<void> {
  await db.dataAccessLog.create({
    data: {
      patientId: entry.patientId,
      actorUserId: entry.actorUserId ?? null,
      actorLabel: entry.actorLabel,
      consentId: entry.consentId ?? null,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      action: entry.action,
      purpose: entry.purpose ?? null,
      result: entry.result ?? "ALLOWED",
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

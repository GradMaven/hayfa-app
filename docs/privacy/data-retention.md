# Data Retention

Per §79: no category of health data should have unbounded, undefined retention. This document states the *current* technical behavior and flags what still needs an operator/legal retention policy decision — it does not itself set legal retention periods, which is a Kenyan-regulatory question (§77) outside engineering's authority to decide.

## Current technical behavior

| Category | Delete behavior today | Configurable? |
|---|---|---|
| Clinical records (conditions, medications, labs, vitals, allergies, immunizations, procedures, documents, appointments, care plans) | Soft delete only (`deletedAt` set, row never removed) — see [database-architecture.md](../database-architecture.md) | No automatic purge; retention period is not yet enforced by code |
| `Consent`, `CaregiverLink`, `EmergencyAccess` | Status transitions (`REVOKED`/`EXPIRED`), never deleted | N/A — these are historical grant records by design |
| `DataAccessLog`, `AuditEvent` | Append-only, never deleted | N/A — this is the accountability record itself |
| `Session`, password-reset/verification tokens | Marked revoked/used, not purged | No automatic purge job exists yet |
| Object storage (document bytes) | Retained even after the `Document` row is soft-deleted | No lifecycle policy configured on the bucket in this phase |
| Backups | Not configured in this phase (no deployment target has been chosen) | N/A |

## What's missing before this can be called "retention-compliant"

1. **A stated retention period per category**, set by policy (legal/clinical-records requirements in Kenya, likely years not months for clinical data) — not invented by this codebase.
2. **A purge/anonymization job** that actually acts on that period once set — none exists; soft-delete today is indefinite.
3. **A storage lifecycle policy** on the document bucket mirroring the same period.
4. **Backup retention and deletion propagation** — deleting a record in the primary database does not currently reach into infrastructure backups (this is true of nearly every system without deliberate backup-purge tooling, worth stating explicitly rather than assuming).

## Why soft-delete is the right default regardless of retention period

Hard-deleting a clinical record the moment a user clicks "delete" would make the audit trail (`DataAccessLog` referencing that record) and the timeline (`HealthEvent` referencing it) either dangling or force a cascade delete that erases history a compliance review might need later. Soft-delete keeps the option open to purge *on a schedule*, which is the right shape for a retention policy — the missing piece is the schedule itself, not the deletion mechanism.

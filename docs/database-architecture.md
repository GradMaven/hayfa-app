# Database Architecture

PostgreSQL via Prisma. Full schema: [`prisma/schema.prisma`](../prisma/schema.prisma) — this doc explains the *why* behind its structure; treat the schema file as the source of truth for field-level detail.

## Conventions used throughout

- **IDs**: `cuid()` everywhere — sortable-ish, collision-resistant, no coordination needed across services later.
- **Timestamps**: every model gets `createdAt`; mutable models get `updatedAt`.
- **Soft delete**: clinical record models (`Encounter`, `Diagnosis`, `Condition`, `Medication`, `LabResult`, `Vital`, `Immunization`, `Procedure`, `Allergy`, `Document`, `Appointment`, `CarePlan`) carry `deletedAt DateTime?`. Nothing in the health record is hard-deleted from the app layer — see §32/§79. **`Consent`, `DataAccessLog`, `AuditEvent`, `EmergencyAccess`, and `CorrectionRequest` are never soft-deleted either; they are append-only by design** (a revoked consent becomes `status: REVOKED`, it does not disappear; a correction is never edited or removed once applied).
- **Provenance** (§31): every clinical fact carries `source: DataSourceType` (patient-entered, provider-entered, hospital integration, lab integration, insurance integration, wearable, OCR, imported document, API) and `verificationStatus` (unverified, pending, provider-verified, AI-extracted-unconfirmed, patient-confirmed, **patient-corrected**). The UI must always be able to answer "where did this come from" — see [../src/lib/validation](../src/lib/validation) for how these are defaulted on create. `PATIENT_CORRECTED` is set only by the data correction workflow below, and is deliberately distinct from `PATIENT_CONFIRMED` ("the patient accepted an AI draft as-is") — it means the patient disputed and changed a value the original source asserted, which is a different provenance fact worth its own status.

## Entity map (why each relationship exists)

```
User ──1:1── PatientProfile ──1:N── {Encounter, Diagnosis, Condition, Medication,
             │                        LabTest, LabResult, Vital, Immunization,
             │                        Procedure, Allergy, Document, Appointment,
             │                        CarePlan, HealthEvent, Consent*, EmergencyAccess}
             │
             ├──1:1── HealthcareProvider ──N:1── Organization
             │
             ├──N:N── CaregiverLink ──N:1── User (as caregiver)
             │
             └──1:N── Session (revocable login sessions)

Consent ──N:1── PatientProfile (owner)
Consent ──N:1── User (recipient, nullable — a consent can be granted before the
                        recipient has an account, e.g. "Dr. Jane Mwangi" by name)
Consent ──1:N── DataAccessLog (every access under this grant is logged)

AuditEvent ──N:1── User (actor, nullable — system-initiated events have no actor)

CorrectionRequest ──N:1── PatientProfile (owner)
CorrectionRequest ──N:1── User (requestedBy — always the patient, per lib/api/patient-scope's ownership-only check)
```

`HealthEvent` is deliberately **not** a parallel data store (§33). It's a thin, denormalized index row (`type`, `title`, `eventDate`, `sourceEntityType`, `sourceEntityId`) written by the same service call that creates the underlying `Medication`/`LabResult`/`Diagnosis`/etc. record, purely so the timeline can be queried with one indexed scan instead of a fan-out across a dozen tables. If it and its source record ever disagree, the source record wins — the app never reads clinical detail back out of `HealthEvent`, only enough to render a timeline row and link through.

## Why Consent and DataAccessLog are separate models

A `Consent` is a *grant* (§27): who, what scope, how long, current status. A `DataAccessLog` row is a *fact*: this actor looked at this resource at this time (§30). One consent produces many access-log rows over its lifetime; deleting/expiring the consent must never delete the history of what already happened under it — hence `DataAccessLog.consentId` is nullable-on-delete-safe (`onDelete: SetNull` semantics enforced at the FK, never a cascade).

## Why `EmergencyAccess` is its own model instead of a `Consent` variant

Emergency access is patient-*absent*, not patient-*granted* — it's authorized by policy (a verified provider + a stated emergency reason), not by a consent the patient clicked through. Keeping it a distinct model makes it impossible for emergency-access code paths to accidentally reuse the "patient granted this" consent-checking logic, and makes every emergency-access event trivially queryable on its own for the compliance/audit review §29 requires.

## Why `CorrectionRequest` is a separate model instead of just updating the record (§56)

Overwriting a provider-verified field in place would destroy the fact that a provider once asserted a different value — a real provenance loss, not just a UI inconvenience. `CorrectionRequest` exists so `previousValues` (only the fields actually being changed, snapshotted before the write) survives permanently even after the record itself has been updated to `correctedValues`. It's deliberately not folded into `HealthEvent`: a correction is provenance metadata about a record, not a new clinical fact on the timeline, so it's queried directly (`GET /api/v1/corrections?resourceType=&resourceId=`) rather than surfaced as timeline noise. See [security-architecture.md](security-architecture.md) "Data correction workflow" for the full request/apply flow.

## RBAC surface

`User.role` is the coarse gate (can this role ever call this endpoint). It is never the *only* gate — see [security-architecture.md](security-architecture.md) for why object-level checks are mandatory on top of it, and [../src/lib/consent/](../src/lib/consent/) for the `canAccess()` function that combines role + ownership + consent into one decision.

## Migrations

`prisma migrate dev` generates and applies migrations locally; every schema change ships as a reviewable migration file, never a manual `db push` against a database that holds real data. Production applies migrations via `prisma migrate deploy` in the deploy pipeline, not by hand.

## Indexing

`HealthEvent(patientId, eventDate)` and `DataAccessLog(patientId, createdAt)` are the two hot paths (timeline rendering, access-history rendering) and are explicitly indexed. Additional indexes should be added when real query patterns are observed rather than speculatively.
